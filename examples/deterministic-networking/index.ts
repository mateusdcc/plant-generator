import { PLANT_PRESETS, PlantCompiler, PlantGenerator, PlantSerializer } from "@rbxts/plant-generator";

const model = PlantCompiler.compile(PLANT_PRESETS.bush!);
const serverResult = PlantGenerator.generate(model, { seed: 88, iterations: 4, time: 0.7 });
export const replicated = PlantSerializer.serialize(serverResult.descriptor);
export const clientResult = PlantGenerator.generate(model, {
	seed: replicated.value.seed,
	iterations: replicated.value.iterations,
	time: replicated.value.time,
	parameters: replicated.value.parameterOverrides,
});
