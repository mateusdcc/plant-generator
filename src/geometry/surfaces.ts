import { generateNormals, type MeshData } from "./mesh";
import { type Vec2, type Vec3, vec2, vec3 } from "../math/vector";

/** Parametric surface sampled over normalized `(u,v)` coordinates. @public */
export interface ParametricSurface {
	/** Maps normalized coordinates and growth to a renderer-neutral point. */
	position(u: number, v: number, growth: number): Vec3;
	/** Optionally overrides the default normalized UV coordinates. */
	uv?(u: number, v: number): Vec2;
}

/** Fixed-grid sampling controls; stable counts support smooth animation. @public */
export interface SurfaceSamplingOptions {
	readonly uSegments?: number;
	readonly vSegments?: number;
	readonly growth?: number;
	readonly materialTag?: string;
}

/** Samples a fixed-topology parametric surface. @public */
export function sampleParametricSurface(surface: ParametricSurface, options: SurfaceSamplingOptions = {}): MeshData {
	const uSegments = math.max(1, math.floor(options.uSegments ?? 16));
	const vSegments = math.max(1, math.floor(options.vSegments ?? 8));
	const growth = math.clamp(options.growth ?? 1, 0, 1);
	const vertices = new Array<Vec3>();
	const uvs = new Array<Vec2>();
	const indices = new Array<number>();
	for (let vIndex = 0; vIndex <= vSegments; vIndex++) {
		const v = vIndex / vSegments;
		for (let uIndex = 0; uIndex <= uSegments; uIndex++) {
			const u = uIndex / uSegments;
			vertices.push(surface.position(u, v, growth));
			uvs.push(surface.uv?.(u, v) ?? vec2(u, v));
		}
	}
	const stride = uSegments + 1;
	for (let vIndex = 0; vIndex < vSegments; vIndex++) {
		for (let uIndex = 0; uIndex < uSegments; uIndex++) {
			const a = vIndex * stride + uIndex;
			const b = a + 1;
			const c = a + stride;
			const d = c + 1;
			indices.push(a, c, b, b, c, d);
		}
	}
	return {
		vertices,
		triangleIndices: indices,
		normals: generateNormals(vertices, indices),
		uvs,
		materialGroups: [
			{ tag: options.materialTag ?? "surface", triangleStart: 0, triangleCount: indices.size() / 3 },
		],
		bounds: boundsFor(vertices),
	};
}

function boundsFor(vertices: readonly Vec3[]) {
	let min = vec3(math.huge, math.huge, math.huge);
	let max = vec3(-math.huge, -math.huge, -math.huge);
	for (const point of vertices) {
		min = vec3(math.min(min.x, point.x), math.min(min.y, point.y), math.min(min.z, point.z));
		max = vec3(math.max(max.x, point.x), math.max(max.y, point.y), math.max(max.z, point.z));
	}
	return { min, max };
}

/** Creates a disk or ellipse in the XY plane. @public */
export function createDisk(radiusX = 1, radiusY = radiusX, segments = 24): MeshData {
	const vertices = new Array<Vec3>();
	const uvs = new Array<Vec2>();
	const indices = new Array<number>();
	vertices.push(vec3(0, 0, 0));
	uvs.push(vec2(0.5, 0.5));
	const count = math.max(3, math.floor(segments));
	for (let index = 0; index < count; index++) {
		const angle = (index / count) * math.pi * 2;
		vertices.push(vec3(math.cos(angle) * radiusX, math.sin(angle) * radiusY, 0));
		uvs.push(vec2(math.cos(angle) * 0.5 + 0.5, math.sin(angle) * 0.5 + 0.5));
	}
	for (let index = 0; index < count; index++) indices.push(0, index + 1, ((index + 1) % count) + 1);
	return {
		vertices,
		triangleIndices: indices,
		normals: generateNormals(vertices, indices),
		uvs,
		materialGroups: [{ tag: "disk", triangleStart: 0, triangleCount: count }],
		bounds: boundsFor(vertices),
	};
}

/** Width profile for leaves, petals, ribbons, and lobes. @public */
export type WidthFunction = (normalizedLength: number) => number;

/** Common tapered blade width. @public */
export const taperedBladeWidth: WidthFunction = (t) => math.sin(math.pi * math.clamp(t, 0, 1));

/** Generates a flat or curved botanical blade with stable topology. @public */
export function createBlade(
	length: number,
	width: number,
	options: {
		readonly segments?: number;
		readonly widthFunction?: WidthFunction;
		readonly curvature?: (t: number) => number;
		readonly growth?: number;
		readonly materialTag?: string;
	} = {},
): MeshData {
	const segments = math.max(1, math.floor(options.segments ?? 12));
	const growth = math.clamp(options.growth ?? 1, 0, 1);
	const profile = options.widthFunction ?? taperedBladeWidth;
	const vertices = new Array<Vec3>();
	const uvs = new Array<Vec2>();
	const indices = new Array<number>();
	for (let index = 0; index <= segments; index++) {
		const t = index / segments;
		const halfWidth = profile(t) * width * 0.5 * growth;
		const y = t * length * growth;
		const z = (options.curvature?.(t) ?? 0) * growth;
		vertices.push(vec3(-halfWidth, y, z), vec3(halfWidth, y, z));
		uvs.push(vec2(0, t), vec2(1, t));
		if (index < segments) {
			const a = index * 2;
			indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
		}
	}
	return {
		vertices,
		triangleIndices: indices,
		normals: generateNormals(vertices, indices),
		uvs,
		materialGroups: [{ tag: options.materialTag ?? "blade", triangleStart: 0, triangleCount: indices.size() / 3 }],
		bounds: boundsFor(vertices),
	};
}

/** Creates a petal with optional cup curvature. @public */
export function createPetal(length = 1, width = 0.5, cup = 0.15, growth = 1): MeshData {
	return createBlade(length, width, {
		growth,
		materialTag: "petal",
		widthFunction: (t) => math.sin(math.pi * math.pow(t, 0.7)),
		curvature: (t) => cup * t * t,
	});
}

/** Creates a ribbon surface from a user centerline and widths. @public */
export function createRibbon(centerline: readonly Vec3[], widths: readonly number[]): MeshData {
	assert(
		centerline.size() >= 2 && centerline.size() === widths.size(),
		"ribbon inputs must have matching lengths >= 2",
	);
	const vertices = new Array<Vec3>();
	const uvs = new Array<Vec2>();
	const indices = new Array<number>();
	for (let index = 0; index < centerline.size(); index++) {
		const point = centerline[index] ?? vec3(0, 0, 0);
		const half = (widths[index] ?? 0) * 0.5;
		vertices.push(vec3(point.x - half, point.y, point.z), vec3(point.x + half, point.y, point.z));
		const t = index / (centerline.size() - 1);
		uvs.push(vec2(0, t), vec2(1, t));
		if (index + 1 < centerline.size()) {
			const a = index * 2;
			indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
		}
	}
	return {
		vertices,
		triangleIndices: indices,
		normals: generateNormals(vertices, indices),
		uvs,
		materialGroups: [{ tag: "ribbon", triangleStart: 0, triangleCount: indices.size() / 3 }],
		bounds: boundsFor(vertices),
	};
}
