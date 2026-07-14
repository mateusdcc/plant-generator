import { PLANT_PRESETS, PlantCompiler, PlantGenerator } from "@rbxts/plant-generator";

const model = PlantCompiler.compile(PLANT_PRESETS["timed-tree"]!);
export const session = PlantGenerator.createSession(model, { seed: 91, iterations: 7 });
export function stepFrame(): void {
	session.step(500);
}
