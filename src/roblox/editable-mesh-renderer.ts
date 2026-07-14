import { validateMesh, type MeshData } from "../geometry/mesh";
import type { PlantGenerationResult } from "../runtime/generator";
import type { LodLevel } from "./lod";
import type { PlantRenderHandle, PlantRenderer } from "./renderer";

/** Explicit evolving-platform capability boundary for EditableMesh. @public @experimental */
export interface EditableMeshCapability {
	/** Reports whether the experience and runtime permit EditableMesh creation. */
	isAvailable(): boolean;
	/** Allocates an empty editable mesh when available. */
	createEditableMesh(): EditableMesh | undefined;
	/** Converts a populated editable mesh into a renderable MeshPart. */
	createMeshPart(editableMesh: EditableMesh): MeshPart | undefined;
}

/** Data-conversion result testable without live AssetService access. @public */
export interface EditableMeshConversion {
	readonly vertexIds: readonly number[];
	readonly faceIds: readonly number[];
}

/** Explicit safety limits applied before allocating EditableMesh content. @public */
export interface EditableMeshConversionLimits {
	readonly maxVertices: number;
	readonly maxTriangles: number;
}

/** Roblox's documented per-mesh EditableMesh limits. @public */
export const DEFAULT_EDITABLE_MESH_LIMITS: EditableMeshConversionLimits = {
	maxVertices: 60_000,
	maxTriangles: 20_000,
};

/**
 * Validates and copies renderer-neutral mesh data into an existing EditableMesh.
 *
 * @throws When topology is invalid or the configured vertex/triangle limits are exceeded.
 * @public
 */
export function populateEditableMesh(
	mesh: MeshData,
	editable: EditableMesh,
	limits: EditableMeshConversionLimits = DEFAULT_EDITABLE_MESH_LIMITS,
): EditableMeshConversion {
	const diagnostics = validateMesh(mesh);
	for (const diagnostic of diagnostics) assert(diagnostic.severity !== "error", diagnostic.message);
	assert(mesh.vertices.size() <= limits.maxVertices, `mesh exceeds the ${limits.maxVertices} vertex limit`);
	const triangleCount = mesh.triangleIndices.size() / 3;
	assert(triangleCount <= limits.maxTriangles, `mesh exceeds the ${limits.maxTriangles} triangle limit`);
	const vertexIds = new Array<number>();
	const faceIds = new Array<number>();
	for (const vertex of mesh.vertices) vertexIds.push(editable.AddVertex(new Vector3(vertex.x, vertex.y, vertex.z)));
	for (let index = 0; index + 2 < mesh.triangleIndices.size(); index += 3) {
		const a = vertexIds[mesh.triangleIndices[index] ?? -1];
		const b = vertexIds[mesh.triangleIndices[index + 1] ?? -1];
		const c = vertexIds[mesh.triangleIndices[index + 2] ?? -1];
		assert(a !== undefined && b !== undefined && c !== undefined, "mesh triangle index is invalid");
		faceIds.push(editable.AddTriangle(a, b, c));
	}
	return { vertexIds, faceIds };
}

/** Current AssetService-backed implementation, injected rather than fetched globally. @public @experimental */
export class AssetServiceEditableMeshCapability implements EditableMeshCapability {
	public constructor(private readonly assetService: AssetService) {}

	/** Reports whether the injected AssetService exposes mesh allocation. */
	public isAvailable(): boolean {
		return this.assetService.CreateEditableMesh !== undefined;
	}

	/** Creates an empty EditableMesh or returns `undefined` when unsupported. */
	public createEditableMesh(): EditableMesh | undefined {
		if (!this.isAvailable()) return undefined;
		return this.assetService.CreateEditableMesh();
	}

	/** Creates a MeshPart from the populated EditableMesh content. */
	public createMeshPart(editableMesh: EditableMesh): MeshPart | undefined {
		return this.assetService.CreateMeshPartAsync(Content.fromObject(editableMesh));
	}
}

class EditableMeshHandle implements PlantRenderHandle {
	public constructor(
		private readonly part: MeshPart,
		private readonly editable: EditableMesh,
	) {}

	public setGrowth(growth: number): void {
		this.part.Transparency = growth <= 0 ? 1 : 0;
		this.part.Size = new Vector3(math.max(growth, 0.001), math.max(growth, 0.001), math.max(growth, 0.001));
	}

	public setTime(time: number): void {
		this.setGrowth(time);
	}

	public setLod(_level: LodLevel): void {}

	public updateTransform(transform: CFrame): void {
		this.part.CFrame = transform;
	}

	public updateMaterialTag(_tag: string, material: Enum.Material, color?: Color3): void {
		this.part.Material = material;
		if (color !== undefined) this.part.Color = color;
	}

	public getStatistics(): Readonly<Record<string, number>> {
		return { renderedInstances: 1 };
	}

	public cancel(): void {}

	public destroy(): void {
		this.part.Destroy();
		this.editable.Destroy();
	}
}

/** EditableMesh renderer that fails explicitly when the capability is unavailable. @public @experimental */
export class EditableMeshPlantRenderer implements PlantRenderer<PlantRenderHandle> {
	public constructor(
		private readonly capability: EditableMeshCapability,
		private readonly parent: Instance,
		private readonly limits: EditableMeshConversionLimits = DEFAULT_EDITABLE_MESH_LIMITS,
	) {}

	/** Validates, uploads, and parents one generated mesh. */
	public render(result: PlantGenerationResult): PlantRenderHandle {
		assert(
			this.capability.isAvailable(),
			"EditableMesh capability is unavailable or not enabled for this experience",
		);
		const editable = this.capability.createEditableMesh();
		assert(editable !== undefined, "EditableMesh creation failed");
		populateEditableMesh(result.meshData, editable, this.limits);
		const part = this.capability.createMeshPart(editable);
		assert(part !== undefined, "MeshPart creation from EditableMesh failed");
		part.Parent = this.parent;
		return new EditableMeshHandle(part, editable);
	}
}
