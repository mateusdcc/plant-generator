import { Diagnostics, type Diagnostic } from "../core/diagnostics";
import type { StructuredParameter } from "../core/symbols";
import { generateNormals, type MeshData } from "../geometry/mesh";
import { normalize3, scale3, type Vec2, type Vec3, vec2, vec3 } from "../math/vector";

/** Vertex in an experimental map L-system. @public @experimental */
export interface CellVertex {
	readonly id: number;
	readonly position: Vec3;
	readonly attributes: StructuredParameter;
}

/** Undirected edge in a cellular map. @public @experimental */
export interface CellEdge {
	readonly id: number;
	readonly a: number;
	readonly b: number;
	readonly faceIds: readonly number[];
	readonly attributes: StructuredParameter;
}

/** Ordered polygonal face/cell. @public @experimental */
export interface CellFace {
	readonly id: number;
	readonly vertexIds: readonly number[];
	readonly attributes: StructuredParameter;
}

/** Planar or surface-projected cellular map. @public @experimental */
export interface CellMap {
	readonly vertices: readonly CellVertex[];
	readonly edges: readonly CellEdge[];
	readonly faces: readonly CellFace[];
}

function edgeKey(a: number, b: number): string {
	return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function rebuildEdges(vertices: readonly CellVertex[], faces: readonly CellFace[]): CellMap {
	const edges = new Array<CellEdge>();
	const index: Record<string, number> = {};
	for (const face of faces) {
		for (let offset = 0; offset < face.vertexIds.size(); offset++) {
			const a = face.vertexIds[offset];
			const b = face.vertexIds[(offset + 1) % face.vertexIds.size()];
			if (a === undefined || b === undefined) continue;
			const key = edgeKey(a, b);
			const existing = index[key];
			if (existing === undefined) {
				index[key] = edges.size();
				edges.push({ id: edges.size(), a, b, faceIds: [face.id], attributes: {} });
			} else {
				const edge = edges[existing];
				if (edge !== undefined) edges[existing] = { ...edge, faceIds: [...edge.faceIds, face.id] };
			}
		}
	}
	return { vertices, edges, faces };
}

/** Creates a deterministic rectangular cellular layer. @public @experimental */
export function createPlanarCellLayer(columns: number, rows: number, size = 1): CellMap {
	const width = math.max(1, math.floor(columns));
	const height = math.max(1, math.floor(rows));
	const vertices = new Array<CellVertex>();
	const faces = new Array<CellFace>();
	for (let y = 0; y <= height; y++) {
		for (let x = 0; x <= width; x++)
			vertices.push({ id: vertices.size(), position: vec3(x * size, y * size, 0), attributes: {} });
	}
	const stride = width + 1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const a = y * stride + x;
			faces.push({ id: faces.size(), vertexIds: [a, a + 1, a + stride + 1, a + stride], attributes: {} });
		}
	}
	return rebuildEdges(vertices, faces);
}

/**
 * Deterministically divides selected polygon cells by a centroid fan.
 *
 * @remarks This preserves contact adjacency explicitly, matching the map
 * rewriting distinction in Chapter 7 while remaining bounded and general.
 * @public @experimental
 */
export function divideCells(map: CellMap, shouldDivide: (face: CellFace) => boolean): CellMap {
	const vertices = new Array<CellVertex>();
	for (const vertex of map.vertices) vertices.push(vertex);
	const faces = new Array<CellFace>();
	for (const face of map.faces) {
		if (!shouldDivide(face) || face.vertexIds.size() < 3) {
			faces.push({ ...face, id: faces.size() });
			continue;
		}
		let center = vec3(0, 0, 0);
		for (const id of face.vertexIds) {
			const point = vertices[id]?.position ?? vec3(0, 0, 0);
			center = vec3(center.x + point.x, center.y + point.y, center.z + point.z);
		}
		center = scale3(center, 1 / face.vertexIds.size());
		const centerId = vertices.size();
		vertices.push({ id: centerId, position: center, attributes: face.attributes });
		for (let offset = 0; offset < face.vertexIds.size(); offset++) {
			const a = face.vertexIds[offset];
			const b = face.vertexIds[(offset + 1) % face.vertexIds.size()];
			if (a !== undefined && b !== undefined)
				faces.push({ id: faces.size(), vertexIds: [a, b, centerId], attributes: face.attributes });
		}
	}
	return rebuildEdges(vertices, faces);
}

/** Validates topology, edge incidence, and polygon references. @public @experimental */
export function validateCellMap(map: CellMap): readonly Diagnostic[] {
	const diagnostics = new Diagnostics();
	for (let index = 0; index < map.vertices.size(); index++) {
		if (map.vertices[index]?.id !== index)
			diagnostics.error("INVALID_GRAPH", `Cell vertex ${index} has a noncanonical id.`);
	}
	for (const face of map.faces) {
		if (face.vertexIds.size() < 3)
			diagnostics.error("INVALID_GRAPH", `Cell face ${face.id} has fewer than three vertices.`);
		for (const id of face.vertexIds)
			if (map.vertices[id] === undefined)
				diagnostics.error("INVALID_GRAPH", `Cell face ${face.id} references missing vertex ${id}.`);
	}
	for (const edge of map.edges) {
		if (map.vertices[edge.a] === undefined || map.vertices[edge.b] === undefined)
			diagnostics.error("INVALID_GRAPH", `Cell edge ${edge.id} has a missing endpoint.`);
		if (edge.faceIds.size() > 2) diagnostics.warn("INVALID_GRAPH", `Cell edge ${edge.id} is non-manifold.`);
	}
	return diagnostics.all();
}

/** Triangulates cell boundaries into renderer-neutral mesh data. @public @experimental */
export function cellMapToMesh(map: CellMap, materialTag = "cellular"): MeshData {
	const vertices = new Array<Vec3>();
	const uvs = new Array<Vec2>();
	const indices = new Array<number>();
	for (const vertex of map.vertices) {
		vertices.push(vertex.position);
		uvs.push(vec2(vertex.position.x, vertex.position.y));
	}
	for (const face of map.faces) {
		const root = face.vertexIds[0];
		if (root === undefined) continue;
		for (let index = 1; index + 1 < face.vertexIds.size(); index++) {
			const b = face.vertexIds[index];
			const c = face.vertexIds[index + 1];
			if (b !== undefined && c !== undefined) indices.push(root, b, c);
		}
	}
	let min = vec3(math.huge, math.huge, math.huge);
	let max = vec3(-math.huge, -math.huge, -math.huge);
	for (const point of vertices) {
		min = vec3(math.min(min.x, point.x), math.min(min.y, point.y), math.min(min.z, point.z));
		max = vec3(math.max(max.x, point.x), math.max(max.y, point.y), math.max(max.z, point.z));
	}
	return {
		vertices,
		triangleIndices: indices,
		normals: generateNormals(vertices, indices),
		uvs,
		materialGroups: [{ tag: materialTag, triangleStart: 0, triangleCount: indices.size() / 3 }],
		bounds: vertices.size() === 0 ? { min: vec3(0, 0, 0), max: vec3(0, 0, 0) } : { min, max },
	};
}

/** Projects a cell layer onto a sphere. @public @experimental */
export function createSphericalCellLayer(columns: number, rows: number, radius = 1): CellMap {
	const planar = createPlanarCellLayer(columns, rows, 1);
	const width = math.max(1, math.floor(columns));
	const height = math.max(1, math.floor(rows));
	const vertices = new Array<CellVertex>();
	for (const vertex of planar.vertices) {
		const longitude = (vertex.position.x / width) * math.pi * 2;
		const latitude = (vertex.position.y / height - 0.5) * math.pi;
		const radial = normalize3(
			vec3(
				math.cos(latitude) * math.cos(longitude),
				math.cos(latitude) * math.sin(longitude),
				math.sin(latitude),
			),
		);
		vertices.push({ ...vertex, position: scale3(radial, radius) });
	}
	return rebuildEdges(vertices, planar.faces);
}

/** Orthogonal volumetric cell used by the basic 3D cellular representation. @public @experimental */
export interface VolumeCell {
	readonly id: number;
	readonly min: Vec3;
	readonly max: Vec3;
	readonly neighborIds: readonly number[];
	readonly attributes: StructuredParameter;
}

/** Functional baseline for three-dimensional cellular structures. @public @experimental */
export function createCellVolume(columns: number, rows: number, layers: number, size = 1): readonly VolumeCell[] {
	const width = math.max(1, math.floor(columns));
	const height = math.max(1, math.floor(rows));
	const depth = math.max(1, math.floor(layers));
	const cells = new Array<VolumeCell>();
	const idAt = (x: number, y: number, z: number) => z * width * height + y * width + x;
	for (let z = 0; z < depth; z++) {
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const neighbors = new Array<number>();
				if (x > 0) neighbors.push(idAt(x - 1, y, z));
				if (x + 1 < width) neighbors.push(idAt(x + 1, y, z));
				if (y > 0) neighbors.push(idAt(x, y - 1, z));
				if (y + 1 < height) neighbors.push(idAt(x, y + 1, z));
				if (z > 0) neighbors.push(idAt(x, y, z - 1));
				if (z + 1 < depth) neighbors.push(idAt(x, y, z + 1));
				cells.push({
					id: idAt(x, y, z),
					min: vec3(x * size, y * size, z * size),
					max: vec3((x + 1) * size, (y + 1) * size, (z + 1) * size),
					neighborIds: neighbors,
					attributes: {},
				});
			}
		}
	}
	return cells;
}
