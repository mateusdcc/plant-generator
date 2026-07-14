import { createBlade, createPetal } from "../geometry/surfaces";
import { mergeMeshes, transformMesh, type MeshData } from "../geometry/mesh";
import { IDENTITY_FRAME, rotateFrame, type Transform3, vec3 } from "../math/vector";

/** Compound-leaf placement result with a rachis and generic leaflet sockets. @public */
export interface CompoundLeaf {
	readonly rachisLength: number;
	readonly leafletTransforms: readonly Transform3[];
	readonly mesh: MeshData;
}

/** Creates opposite or alternate leaflets along a rachis. @public */
export function createCompoundLeaf(options: {
	readonly pairs: number;
	readonly rachisLength?: number;
	readonly leafletLength?: number;
	readonly leafletWidth?: number;
	readonly alternate?: boolean;
	readonly terminalLeaflet?: boolean;
	readonly growth?: number;
}): CompoundLeaf {
	const pairCount = math.max(1, math.floor(options.pairs));
	const rachisLength = options.rachisLength ?? 2;
	const leaflet = createBlade(options.leafletLength ?? 0.6, options.leafletWidth ?? 0.25, {
		growth: options.growth ?? 1,
		materialTag: "leaflet",
	});
	const transforms = new Array<Transform3>();
	const meshes = new Array<MeshData>();
	for (let pair = 0; pair < pairCount; pair++) {
		const t = (pair + 1) / (pairCount + 1);
		for (let side = -1; side <= 1; side += 2) {
			if (options.alternate === true && side === 1 && pair % 2 === 1) continue;
			if (options.alternate === true && side === -1 && pair % 2 === 0) continue;
			let frame = rotateFrame(IDENTITY_FRAME, IDENTITY_FRAME.up, (side * math.pi) / 2);
			frame = rotateFrame(frame, frame.left, math.pi / 10);
			const transform: Transform3 = { position: vec3(0, t * rachisLength, 0), frame, scale: vec3(1, 1, 1) };
			transforms.push(transform);
			meshes.push(transformMesh(leaflet, transform));
		}
	}
	if (options.terminalLeaflet !== false) {
		const transform: Transform3 = {
			position: vec3(0, rachisLength, 0),
			frame: IDENTITY_FRAME,
			scale: vec3(1, 1, 1),
		};
		transforms.push(transform);
		meshes.push(transformMesh(leaflet, transform));
	}
	return { rachisLength, leafletTransforms: transforms, mesh: mergeMeshes(meshes) };
}

/** Generic radial flower groups without requiring a renderer or texture. @public */
export function createRadialFlower(
	options: {
		readonly petals?: number;
		readonly sepals?: number;
		readonly stamens?: number;
		readonly petalLength?: number;
		readonly petalWidth?: number;
		readonly opening?: number;
	} = {},
): MeshData {
	const meshes = new Array<MeshData>();
	const petals = math.max(1, math.floor(options.petals ?? 6));
	const opening = math.clamp(options.opening ?? 1, 0, 1);
	const petal = createPetal(options.petalLength ?? 1, options.petalWidth ?? 0.45, 0.15, opening);
	for (let index = 0; index < petals; index++) {
		let frame = rotateFrame(IDENTITY_FRAME, IDENTITY_FRAME.up, (index / petals) * math.pi * 2);
		frame = rotateFrame(frame, frame.left, -opening * math.pi * 0.4);
		meshes.push(transformMesh(petal, { position: vec3(0, 0, 0), frame, scale: vec3(1, 1, 1) }));
	}
	return mergeMeshes(meshes);
}
