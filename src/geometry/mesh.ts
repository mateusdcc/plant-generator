import { Diagnostics, type Diagnostic } from "../core/diagnostics";
import {
	add3,
	cross3,
	isFinite3,
	normalize3,
	scale3,
	sub3,
	transformPoint,
	type Transform3,
	type Vec2,
	type Vec3,
	vec2,
	vec3,
} from "../math/vector";
import type { Bounds3 } from "../topology/branch-graph";

/** Optional per-vertex RGBA color independent of Roblox Color3. @public */
export interface VertexColor {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a: number;
}

/** Contiguous triangle range sharing a material tag. @public */
export interface MaterialGroup {
	readonly tag: string;
	readonly triangleStart: number;
	readonly triangleCount: number;
}

/** Renderer-neutral indexed triangle mesh. @public */
export interface MeshData {
	readonly vertices: readonly Vec3[];
	readonly triangleIndices: readonly number[];
	readonly normals: readonly Vec3[];
	readonly uvs: readonly Vec2[];
	readonly colors?: readonly VertexColor[];
	readonly tangents?: readonly Vec3[];
	readonly vertexTags?: readonly string[];
	readonly materialGroups: readonly MaterialGroup[];
	readonly bounds: Bounds3;
}

/** Creates an empty valid mesh. @public */
export function emptyMesh(): MeshData {
	return {
		vertices: [],
		triangleIndices: [],
		normals: [],
		uvs: [],
		materialGroups: [],
		bounds: { min: vec3(0, 0, 0), max: vec3(0, 0, 0) },
	};
}

/** Computes vertex bounds. @public */
export function computeMeshBounds(vertices: readonly Vec3[]): Bounds3 {
	if (vertices.size() === 0) return emptyMesh().bounds;
	return boundsFromPoints(vertices);
}

function boundsFromPoints(vertices: readonly Vec3[]): Bounds3 {
	let min = vec3(math.huge, math.huge, math.huge);
	let max = vec3(-math.huge, -math.huge, -math.huge);
	for (const point of vertices) {
		min = vec3(math.min(min.x, point.x), math.min(min.y, point.y), math.min(min.z, point.z));
		max = vec3(math.max(max.x, point.x), math.max(max.y, point.y), math.max(max.z, point.z));
	}
	return { min, max };
}

/** Validates index ranges, attribute counts, finiteness, and triangle arity. @public */
export function validateMesh(mesh: MeshData): readonly Diagnostic[] {
	const diagnostics = new Diagnostics();
	if (mesh.triangleIndices.size() % 3 !== 0)
		diagnostics.error("INVALID_MESH", "Triangle index count must be divisible by three.");
	if (mesh.normals.size() !== 0 && mesh.normals.size() !== mesh.vertices.size()) {
		diagnostics.error("INVALID_MESH", "Normal count must be zero or equal to vertex count.");
	}
	if (mesh.uvs.size() !== 0 && mesh.uvs.size() !== mesh.vertices.size()) {
		diagnostics.error("INVALID_MESH", "UV count must be zero or equal to vertex count.");
	}
	for (let index = 0; index < mesh.vertices.size(); index++) {
		if (!isFinite3(mesh.vertices[index] ?? vec3(math.huge, 0, 0)))
			diagnostics.error("INVALID_MESH", `Vertex ${index} is not finite.`);
	}
	for (let index = 0; index < mesh.triangleIndices.size(); index++) {
		const vertexIndex = mesh.triangleIndices[index] ?? -1;
		if (vertexIndex < 0 || vertexIndex >= mesh.vertices.size() || vertexIndex !== math.floor(vertexIndex)) {
			diagnostics.error("INVALID_MESH", `Triangle index ${index} references invalid vertex ${vertexIndex}.`);
		}
	}
	return diagnostics.all();
}

/** Computes smooth per-vertex normals from indexed faces. @public */
export function generateNormals(vertices: readonly Vec3[], indices: readonly number[]): readonly Vec3[] {
	const sums = new Array<Vec3>();
	for (let index = 0; index < vertices.size(); index++) sums.push(vec3(0, 0, 0));
	for (let index = 0; index + 2 < indices.size(); index += 3) {
		const aIndex = indices[index] ?? 0;
		const bIndex = indices[index + 1] ?? 0;
		const cIndex = indices[index + 2] ?? 0;
		const a = vertices[aIndex];
		const b = vertices[bIndex];
		const c = vertices[cIndex];
		if (a === undefined || b === undefined || c === undefined) continue;
		const normal = cross3(sub3(b, a), sub3(c, a));
		sums[aIndex] = add3(sums[aIndex] ?? vec3(0, 0, 0), normal);
		sums[bIndex] = add3(sums[bIndex] ?? vec3(0, 0, 0), normal);
		sums[cIndex] = add3(sums[cIndex] ?? vec3(0, 0, 0), normal);
	}
	const normals = new Array<Vec3>();
	for (const value of sums) normals.push(normalize3(value, vec3(0, 0, 1)));
	return normals;
}

/** Merges meshes while remapping indices and material ranges. @public */
export function mergeMeshes(meshes: readonly MeshData[]): MeshData {
	const vertices = new Array<Vec3>();
	const indices = new Array<number>();
	const normals = new Array<Vec3>();
	const uvs = new Array<Vec2>();
	const groups = new Array<MaterialGroup>();
	for (const mesh of meshes) {
		const vertexOffset = vertices.size();
		const triangleOffset = indices.size() / 3;
		for (const value of mesh.vertices) vertices.push(value);
		for (const value of mesh.triangleIndices) indices.push(value + vertexOffset);
		for (const value of mesh.normals) normals.push(value);
		for (const value of mesh.uvs) uvs.push(value);
		for (const group of mesh.materialGroups)
			groups.push({ ...group, triangleStart: group.triangleStart + triangleOffset });
	}
	const resolvedNormals = normals.size() === vertices.size() ? normals : generateNormals(vertices, indices);
	while (uvs.size() < vertices.size()) uvs.push(vec2(0, 0));
	return {
		vertices,
		triangleIndices: indices,
		normals: resolvedNormals,
		uvs,
		materialGroups: groups,
		bounds: computeMeshBounds(vertices),
	};
}

/** Transforms mesh positions and orientation attributes. @public */
export function transformMesh(mesh: MeshData, transform: Transform3): MeshData {
	const vertices = new Array<Vec3>();
	const normals = new Array<Vec3>();
	for (const vertex of mesh.vertices) vertices.push(transformPoint(transform, vertex));
	for (const normal of mesh.normals) {
		normals.push(
			normalize3(
				add3(
					scale3(transform.frame.left, -normal.x),
					add3(scale3(transform.frame.heading, normal.y), scale3(transform.frame.up, normal.z)),
				),
			),
		);
	}
	return { ...mesh, vertices, normals, bounds: computeMeshBounds(vertices) };
}
