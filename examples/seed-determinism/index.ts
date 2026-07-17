import {
	PlantCompiler,
	PlantGenerator,
	hashBranchGraph,
	symbol,
	type ModelSpecification,
} from "@rbxts/a-plant-generator";

const stochasticTree: ModelSpecification = {
	schemaVersion: 1,
	id: "seed-determinism-tree",
	grammar: {
		alphabet: ["A", "F", "+", "-", "^", "&", "\\", "/", "[", "]", "!"].map((id) => ({ id })),
		axiom: [symbol("A")],
		productions: [
			{
				id: "wide",
				predecessor: "A",
				weight: 1,
				successor: [
					symbol("F", 1.65),
					symbol("!", 0.78),
					symbol("["),
					symbol("+", 0.62),
					symbol("^", 0.22),
					symbol("A"),
					symbol("]"),
					symbol("["),
					symbol("-", 0.45),
					symbol("\\", 0.55),
					symbol("A"),
					symbol("]"),
					symbol("A"),
				],
			},
			{
				id: "narrow",
				predecessor: "A",
				weight: 1,
				successor: [
					symbol("F", 1.35),
					symbol("!", 0.82),
					symbol("["),
					symbol("+", 0.32),
					symbol("/", 0.7),
					symbol("A"),
					symbol("]"),
					symbol("["),
					symbol("-", 0.32),
					symbol("&", 0.18),
					symbol("A"),
					symbol("]"),
					symbol("A"),
				],
			},
		],
		branchOpenSymbol: "[",
		branchCloseSymbol: "]",
	},
	turtle: { stepSize: 2.2, initialWidth: 0.46, widthDecay: 0.86, unknownSymbolPolicy: "ignore" },
	geometry: { enabled: false },
	organs: { terminalLeafKind: "leaf", leafDensity: 1 },
};

const model = PlantCompiler.compile(stochasticTree);
const options = { seed: 42, iterations: 5 } as const;

export const reference = PlantGenerator.generate(model, options);
export const replay = PlantGenerator.generate(model, options);
export const seed7 = PlantGenerator.generate(model, { ...options, seed: 7 });
export const seed99 = PlantGenerator.generate(model, { ...options, seed: 99 });

export const deterministicHashes = {
	reference: hashBranchGraph(reference.branchGraph),
	replay: hashBranchGraph(replay.branchGraph),
	seed7: hashBranchGraph(seed7.branchGraph),
	seed99: hashBranchGraph(seed99.branchGraph),
};

export const replayMatches = deterministicHashes.reference === deterministicHashes.replay;
