import { PlantCompiler, PlantGenerator, symbol, type ModelSpecification } from "@rbxts/plant-generator";

const model: ModelSpecification = {
	schemaVersion: 1,
	id: "stochastic-garden",
	grammar: {
		alphabet: ["A", "F", "+", "-"].map((id) => ({ id })),
		axiom: [symbol("A")],
		productions: [
			{ id: "left", predecessor: "A", weight: 1, successor: [symbol("F"), symbol("+", 0.5), symbol("A")] },
			{ id: "right", predecessor: "A", weight: 1, successor: [symbol("F"), symbol("-", 0.5), symbol("A")] },
		],
	},
};

export const garden = [1, 2, 3].map((seed) =>
	PlantGenerator.generate(PlantCompiler.compile(model), { seed, iterations: 6 }),
);
