import { DistanceLodPolicy, PLANT_PRESETS, PlantCompiler, PlantGenerator } from "@rbxts/a-plant-generator";

const result = PlantGenerator.generate(PlantCompiler.compile(PLANT_PRESETS.conifer!), { seed: 2, iterations: 4 });
const policy = new DistanceLodPolicy(60, 140, 300);
export const forestLods = [25, 90, 200, 500].map((distance) => policy.select(distance, result));
