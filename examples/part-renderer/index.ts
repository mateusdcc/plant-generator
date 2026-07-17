import { PLANT_PRESETS, PartPlantRenderer, PlantCompiler, PlantGenerator } from "@rbxts/a-plant-generator";

export function renderTree(parent: Instance) {
	const result = PlantGenerator.generate(PlantCompiler.compile(PLANT_PRESETS.conifer!), { seed: 4, iterations: 4 });
	return new PartPlantRenderer({ parent, maxInstances: 2_000 }).render(result);
}
