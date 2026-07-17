import {
	PLANT_PRESETS,
	PlantCompiler,
	PlantGenerator,
	transformMesh,
	IDENTITY_FRAME,
	vec3,
} from "@rbxts/a-plant-generator";

const arch = PlantGenerator.generate(PlantCompiler.compile(PLANT_PRESETS["botanical-arch"]!), {
	seed: 5,
	iterations: 4,
});
export const mirroredArch = transformMesh(arch.meshData, {
	position: vec3(8, 0, 0),
	frame: IDENTITY_FRAME,
	scale: vec3(-1, 1, 1),
});
