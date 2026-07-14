import { PlantCompiler, PlantGenerator, symbol, type ModelSpecification } from "@rbxts/plant-generator";

const specification: ModelSpecification = {
	schemaVersion: 1,
	id: "custom-koch-plant",
	grammar: {
		alphabet: [{ id: "F" }, { id: "+" }, { id: "-" }],
		axiom: [symbol("F")],
		productions: [
			{
				id: "koch",
				predecessor: "F",
				successor: [
					symbol("F"),
					symbol("+", math.pi / 3),
					symbol("F"),
					symbol("-", (2 * math.pi) / 3),
					symbol("F"),
					symbol("+", math.pi / 3),
					symbol("F"),
				],
			},
		],
	},
};

export const result = PlantGenerator.generate(PlantCompiler.compile(specification), { seed: 1, iterations: 3 });
