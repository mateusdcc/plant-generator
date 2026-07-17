import { PLANT_PRESETS, PlantCompiler, PlantGenerator } from "@rbxts/a-plant-generator";

export const galleryEntries = [
	{ presetId: "flowering-stem", seed: 2026, iterations: 5 },
	{ presetId: "branching-herb", seed: 2026, iterations: 5 },
	{ presetId: "bush", seed: 2026, iterations: 4 },
	{ presetId: "conifer", seed: 2026, iterations: 6 },
	{ presetId: "broad-canopy-tree", seed: 2026, iterations: 4 },
	{ presetId: "vine", seed: 2026, iterations: 6 },
] as const;

export const presetGallery = galleryEntries.map((entry) => ({
	...entry,
	result: PlantGenerator.generate(PlantCompiler.compile(PLANT_PRESETS[entry.presetId]!), {
		seed: entry.seed,
		iterations: entry.iterations,
		limits: { maxSymbols: 25_000, maxSegments: 2_000 },
	}),
}));
