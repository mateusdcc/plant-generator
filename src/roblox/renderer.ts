import type { Vec3 } from "../math/vector";
import type { PlantGenerationResult } from "../runtime/generator";
import type { LodLevel } from "./lod";

/** Renderer handle owns every created resource and supports deterministic cleanup. @public */
export interface PlantRenderHandle {
	/** Applies raw normalized developmental time to structural and organ growth. */
	setGrowth(growth: number): void;
	/** Applies an absolute or renderer-defined timeline time. */
	setTime(time: number): void;
	/** Changes the active level-of-detail policy result. */
	setLod(level: LodLevel): void;
	/** Moves the owned render root without regenerating topology. */
	updateTransform(transform: CFrame): void;
	/** Replaces material styling for instances with a matching semantic tag. */
	updateMaterialTag(tag: string, material: Enum.Material, color?: Color3): void;
	/** Returns adapter-specific counters for diagnostics and profiling. */
	getStatistics(): Readonly<Record<string, number>>;
	/** Stops pending streaming work without destroying existing output. */
	cancel(): void;
	/** Releases all Instances and adapter-owned resources. */
	destroy(): void;
}

/** Incremental renderer handle. @public */
export interface StreamingPlantRenderHandle extends PlantRenderHandle {
	/** Creates at most the requested number of remaining Instances. */
	step(maximumInstances: number): number;
	/** Reports whether streaming finished or was cancelled. */
	isComplete(): boolean;
}

/** Custom renderer boundary implemented by package consumers or adapters. @public */
export interface PlantRenderer<THandle extends PlantRenderHandle = PlantRenderHandle> {
	/** Renders a renderer-neutral generation result and returns an owning handle. */
	render(result: PlantGenerationResult): THandle;
}

/** Converts plain vector data only inside the Roblox adapter. @public */
export function toRobloxVector(value: Vec3): Vector3 {
	return new Vector3(value.x, value.y, value.z);
}
