import { PLANT_PRESETS, PlantCompiler, PlantGenerator } from "@rbxts/a-plant-generator";

const model = PlantCompiler.compile(PLANT_PRESETS["broad-canopy-tree"]!);
export const tree = PlantGenerator.generate(model, { seed: 2026, iterations: 5 });
