import type { PlantGenerationResult } from "../runtime/generator";

/** Standard renderer detail levels plus consumer-defined string levels. @public */
export type LodLevel = "full" | "medium" | "low" | "impostor" | (string & {});

/** Selected LOD generation/render limits. @public */
export interface LodSettings {
	readonly level: LodLevel;
	readonly maxBranchDepth: number;
	readonly radialResolution: number;
	readonly leafDensity: number;
	readonly flowerDensity: number;
	readonly animationDetail: number;
	readonly maxInstances: number;
	readonly maxVertices: number;
}

/** Selects a renderer LOD from caller-owned context. @public */
export interface LodPolicy {
	/** Selects detail settings from camera distance and generated complexity. */
	select(distance: number, result: PlantGenerationResult): LodSettings;
}

/** Configurable distance-based LOD policy. @public */
export class DistanceLodPolicy implements LodPolicy {
	public constructor(
		private readonly mediumDistance = 80,
		private readonly lowDistance = 180,
		private readonly impostorDistance = 350,
	) {}

	/** Selects the configured distance band and its generation/render limits. */
	public select(distance: number, _result: PlantGenerationResult): LodSettings {
		if (distance >= this.impostorDistance) {
			return {
				level: "impostor",
				maxBranchDepth: 1,
				radialResolution: 3,
				leafDensity: 0,
				flowerDensity: 0,
				animationDetail: 0,
				maxInstances: 1,
				maxVertices: 64,
			};
		}
		if (distance >= this.lowDistance) {
			return {
				level: "low",
				maxBranchDepth: 2,
				radialResolution: 3,
				leafDensity: 0.1,
				flowerDensity: 0,
				animationDetail: 0.25,
				maxInstances: 250,
				maxVertices: 10_000,
			};
		}
		if (distance >= this.mediumDistance) {
			return {
				level: "medium",
				maxBranchDepth: 5,
				radialResolution: 6,
				leafDensity: 0.5,
				flowerDensity: 0.25,
				animationDetail: 0.5,
				maxInstances: 1_000,
				maxVertices: 50_000,
			};
		}
		return {
			level: "full",
			maxBranchDepth: math.huge,
			radialResolution: 10,
			leafDensity: 1,
			flowerDensity: 1,
			animationDetail: 1,
			maxInstances: 5_000,
			maxVertices: 200_000,
		};
	}
}
