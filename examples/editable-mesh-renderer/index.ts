import {
	EditableMeshPlantRenderer,
	PLANT_PRESETS,
	PlantCompiler,
	PlantGenerator,
	type EditableMeshCapability,
} from "@rbxts/plant-generator";

export function renderMesh(parent: Instance, capability: EditableMeshCapability) {
	const result = PlantGenerator.generate(PlantCompiler.compile(PLANT_PRESETS.vine!), { seed: 7, iterations: 3 });
	return new EditableMeshPlantRenderer(capability, parent).render(result);
}
