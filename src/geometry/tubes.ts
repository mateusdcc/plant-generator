import { generateNormals, mergeMeshes, type MeshData } from "./mesh";
import {
	add3,
	cross3,
	dot3,
	lengthSquared3,
	normalize3,
	rotateAroundAxis,
	scale3,
	sub3,
	type Frame3,
	type Vec2,
	type Vec3,
	vec2,
	vec3,
} from "../math/vector";
import type { BranchGraph, BranchSegment } from "../topology/branch-graph";

/** Options for tapered tubes along a centerline. @public */
export interface TubeOptions {
	readonly radialResolution?: number;
	readonly capStart?: boolean;
	readonly capEnd?: boolean;
	readonly materialTag?: string;
}

function initialFrame(direction: Vec3): Frame3 {
	const heading = normalize3(direction);
	const reference = math.abs(heading.z) < 0.9 ? vec3(0, 0, 1) : vec3(1, 0, 0);
	const left = normalize3(cross3(reference, heading), vec3(-1, 0, 0));
	return { heading, left, up: normalize3(cross3(heading, left), reference) };
}

function transportFrame(previous: Frame3, direction: Vec3): Frame3 {
	const heading = normalize3(direction, previous.heading);
	const axis = cross3(previous.heading, heading);
	if (lengthSquared3(axis) < 1e-12) return { heading, left: previous.left, up: previous.up };
	const angle = math.acos(math.clamp(dot3(previous.heading, heading), -1, 1));
	const left = normalize3(rotateAroundAxis(previous.left, axis, angle), previous.left);
	return { heading, left, up: normalize3(cross3(heading, left), previous.up) };
}

/**
 * Builds a tapered generalized cylinder using parallel-transport frames.
 *
 * @throws If fewer than two points are supplied or radii do not match.
 * @public
 */
export function createTubeMesh(path: readonly Vec3[], radii: readonly number[], options: TubeOptions = {}): MeshData {
	assert(path.size() >= 2, "tube path needs at least two points");
	assert(radii.size() === path.size(), "tube radii must match path points");
	const radial = math.max(3, math.floor(options.radialResolution ?? 8));
	const vertices = new Array<Vec3>();
	const uvs = new Array<Vec2>();
	const indices = new Array<number>();
	const frames = new Array<Frame3>();
	let frame = initialFrame(sub3(path[1] ?? vec3(0, 1, 0), path[0] ?? vec3(0, 0, 0)));
	frames.push(frame);
	for (let index = 1; index < path.size(); index++) {
		const previous = path[index - 1] ?? vec3(0, 0, 0);
		const point = path[index] ?? previous;
		frame = transportFrame(frame, sub3(point, previous));
		frames.push(frame);
	}
	let accumulated = 0;
	for (let ring = 0; ring < path.size(); ring++) {
		if (ring > 0)
			accumulated += math.sqrt(
				lengthSquared3(sub3(path[ring] ?? vec3(0, 0, 0), path[ring - 1] ?? vec3(0, 0, 0))),
			);
		const point = path[ring] ?? vec3(0, 0, 0);
		const radius = math.max(0, radii[ring] ?? 0);
		const ringFrame = frames[ring] ?? frame;
		for (let side = 0; side < radial; side++) {
			const angle = (side / radial) * math.pi * 2;
			const radialVector = add3(scale3(ringFrame.left, math.cos(angle)), scale3(ringFrame.up, math.sin(angle)));
			vertices.push(add3(point, scale3(radialVector, radius)));
			uvs.push(vec2(side / radial, accumulated));
		}
	}
	for (let ring = 0; ring < path.size() - 1; ring++) {
		for (let side = 0; side < radial; side++) {
			const nextSide = (side + 1) % radial;
			const a = ring * radial + side;
			const b = ring * radial + nextSide;
			const c = (ring + 1) * radial + side;
			const d = (ring + 1) * radial + nextSide;
			indices.push(a, c, b, b, c, d);
		}
	}
	if (options.capStart === true) {
		const center = vertices.size();
		vertices.push(path[0] ?? vec3(0, 0, 0));
		uvs.push(vec2(0.5, 0.5));
		for (let side = 0; side < radial; side++) indices.push(center, (side + 1) % radial, side);
	}
	if (options.capEnd === true) {
		const center = vertices.size();
		const ringStart = (path.size() - 1) * radial;
		vertices.push(path[path.size() - 1] ?? vec3(0, 0, 0));
		uvs.push(vec2(0.5, 0.5));
		for (let side = 0; side < radial; side++)
			indices.push(center, ringStart + side, ringStart + ((side + 1) % radial));
	}
	return {
		vertices,
		triangleIndices: indices,
		normals: generateNormals(vertices, indices),
		uvs,
		materialGroups: [{ tag: options.materialTag ?? "branch", triangleStart: 0, triangleCount: indices.size() / 3 }],
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

/** Branch-junction strategy. `overlap` is cheap; `collar` adds a short blending ring. @public */
export type JunctionMode = "overlap" | "collar";

/** Generates branch tube geometry from topology. @public */
export function createBranchMesh(
	graph: BranchGraph,
	options: TubeOptions & { readonly junctionMode?: JunctionMode; readonly maxDepth?: number } = {},
): MeshData {
	const meshes = new Array<MeshData>();
	for (const segment of graph.segments) {
		if (options.maxDepth !== undefined && segment.depth > options.maxDepth) continue;
		meshes.push(segmentMesh(segment, options));
		if (options.junctionMode === "collar" && segment.parentSegmentId !== undefined) {
			const parent = graph.segments[segment.parentSegmentId];
			if (parent !== undefined) {
				const direction = normalize3(sub3(segment.end, segment.start));
				const collarEnd = add3(segment.start, scale3(direction, math.max(segment.radiusStart, 1e-4) * 0.35));
				meshes.push(
					createTubeMesh(
						[segment.start, collarEnd],
						[math.max(segment.radiusStart, parent.radiusEnd), segment.radiusStart],
						{ ...options, capStart: false, capEnd: false, materialTag: options.materialTag ?? "junction" },
					),
				);
			}
		}
	}
	return mergeMeshes(meshes);
}

function segmentMesh(segment: BranchSegment, options: TubeOptions): MeshData {
	return createTubeMesh([segment.start, segment.end], [segment.radiusStart, segment.radiusEnd], {
		...options,
		capStart: options.capStart ?? segment.parentSegmentId === undefined,
		capEnd: options.capEnd ?? true,
	});
}
