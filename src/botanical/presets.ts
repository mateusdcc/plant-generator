import type { AlphabetSymbolSpec, GrammarSpec, ProductionContext } from "../core/grammar";
import { symbol, type ModuleSymbol } from "../core/symbols";
import { extendModelSpecification, MODEL_SCHEMA_VERSION, type ModelSpecification } from "../runtime/specification";

const TURTLE_ALPHABET = ["F", "f", "+", "-", "^", "&", "\\", "/", "[", "]", "!", "L", "K"];
const GOLDEN_ANGLE = math.pi * (3 - math.sqrt(5));

interface PresetOptions {
	readonly leaf?: boolean;
	readonly flower?: boolean;
	readonly radialResolution?: number;
	readonly step?: number;
	readonly width?: number;
	readonly widthDecay?: number;
}

function moduleAlphabet(nonterminals: readonly AlphabetSymbolSpec[]): readonly AlphabetSymbolSpec[] {
	const result = new Array<AlphabetSymbolSpec>();
	for (const entry of nonterminals) result.push(entry);
	for (const id of TURTLE_ALPHABET) result.push({ id });
	return result;
}

function numericParameter(context: ProductionContext, index: number, fallback: number): number {
	const value = context.symbol.parameters[index];
	return typeIs(value, "number") ? value : fallback;
}

function appendBranch(
	result: ModuleSymbol[],
	roll: number,
	inclination: number,
	body: readonly ModuleSymbol[],
	widthScale: number,
): void {
	result.push(symbol("["), symbol("!", widthScale), symbol("\\", roll), symbol("&", inclination));
	for (const value of body) result.push(value);
	result.push(symbol("]"));
}

function createBotanicalPreset(
	id: string,
	description: string,
	grammar: GrammarSpec,
	options: PresetOptions = {},
): ModelSpecification {
	return {
		schemaVersion: MODEL_SCHEMA_VERSION,
		id,
		version: "0.1.0",
		metadata: { name: id, description, tags: ["preset", "botanical", "architecture"] },
		grammar,
		turtle: {
			stepSize: options.step ?? 1,
			initialWidth: options.width ?? 0.18,
			widthDecay: options.widthDecay ?? 0.82,
			unknownSymbolPolicy: "ignore",
		},
		geometry: {
			enabled: true,
			radialResolution: options.radialResolution ?? 8,
			junctionMode: "overlap",
			capBranches: true,
		},
		organs: {
			...(options.leaf === true ? { terminalLeafKind: "leaf", leafDensity: 1 } : {}),
			...(options.flower === true ? { terminalFlowerKind: "flower", flowerDensity: 0.35 } : {}),
		},
		animation: { duration: 10, growthFunctionId: "smootherstep", birthInterval: 0.5 },
		lod: {
			fullDistance: 40,
			mediumDistance: 100,
			lowDistance: 220,
			mediumRadialResolution: 6,
			lowRadialResolution: 3,
		},
	};
}

/**
 * A monopodial stem with a persistent leader and successively rotated lateral
 * flowering shoots. The constants are original, while the use of a dominant
 * axis and radial node succession follows general botanical L-system practice.
 */
function createFloweringStemPreset(): ModelSpecification {
	const grammar: GrammarSpec = {
		alphabet: moduleAlphabet([{ id: "M", parameterTypes: ["number", "number"] }]),
		axiom: [symbol("M", 1, 0)],
		productions: [
			{
				id: "extend-monopodial-leader",
				predecessor: "M",
				successor: (context) => {
					const scale = numericParameter(context, 0, 1);
					const phase = numericParameter(context, 1, 0);
					const result = new Array<ModuleSymbol>();
					result.push(symbol("F", 0.92 * scale));
					appendBranch(
						result,
						phase,
						0.82,
						[symbol("F", 0.48 * scale), symbol("+", 0.24), symbol("F", 0.3 * scale), symbol("K")],
						0.56,
					);
					appendBranch(result, phase + math.pi, 1.02, [symbol("F", 0.28 * scale), symbol("L")], 0.48);
					result.push(symbol("M", scale * 0.91, phase + GOLDEN_ANGLE));
					return result;
				},
			},
		],
		branchOpenSymbol: "[",
		branchCloseSymbol: "]",
	};
	return createBotanicalPreset(
		"flowering-stem",
		"A slender monopodial flowering stem with a dominant leader and rotating lateral shoots.",
		grammar,
		{ leaf: true, flower: true, step: 0.7, width: 0.11, widthDecay: 0.9 },
	);
}

/** A dichasial, sympodial herb: every module ends by handing growth to two axes. */
function createBranchingHerbPreset(): ModelSpecification {
	const grammar: GrammarSpec = {
		alphabet: moduleAlphabet([{ id: "H", parameterTypes: ["number", "number"] }]),
		axiom: [symbol("H", 1, 0)],
		productions: [
			{
				id: "fork-sympodial-apex",
				predecessor: "H",
				successor: (context) => {
					const scale = numericParameter(context, 0, 1);
					const phase = numericParameter(context, 1, 0);
					const result = new Array<ModuleSymbol>();
					result.push(symbol("F", 0.72 * scale));
					appendBranch(result, phase + GOLDEN_ANGLE * 0.5, 1.16, [symbol("L")], 0.5);
					appendBranch(result, phase + GOLDEN_ANGLE * 0.5 + math.pi, 1.16, [symbol("L")], 0.5);
					appendBranch(
						result,
						phase,
						0.44,
						[symbol("F", 0.3 * scale), symbol("H", scale * 0.76, phase + 2.05)],
						0.66,
					);
					appendBranch(
						result,
						phase + math.pi + 0.32,
						0.5,
						[symbol("F", 0.27 * scale), symbol("H", scale * 0.72, phase + 4.08)],
						0.63,
					);
					result.push(symbol("K"));
					return result;
				},
			},
		],
		branchOpenSymbol: "[",
		branchCloseSymbol: "]",
	};
	return createBotanicalPreset(
		"branching-herb",
		"A dichasial sympodial herb whose paired apices repeatedly replace the previous leader.",
		grammar,
		{ leaf: true, flower: true, step: 0.6, width: 0.12, widthDecay: 0.84 },
	);
}

function createBushAxiom(): readonly ModuleSymbol[] {
	const result = new Array<ModuleSymbol>();
	for (let index = 0; index < 6; index++) {
		const phase = (index / 6) * math.pi * 2;
		appendBranch(result, phase, 0.93, [symbol("B", 1, phase)], 1);
	}
	return result;
}

/** Six basal axes recursively produce short continuations and lateral mound fill. */
function createBushPreset(): ModelSpecification {
	const grammar: GrammarSpec = {
		alphabet: moduleAlphabet([{ id: "B", parameterTypes: ["number", "number"] }]),
		axiom: createBushAxiom(),
		productions: [
			{
				id: "fill-basal-shrub-axis",
				predecessor: "B",
				successor: (context) => {
					const scale = numericParameter(context, 0, 1);
					const phase = numericParameter(context, 1, 0);
					const result = new Array<ModuleSymbol>();
					result.push(symbol("F", 0.62 * scale));
					appendBranch(result, 1.82, 0.5, [symbol("B", scale * 0.64, phase + 1.82)], 0.68);
					appendBranch(result, -1.67, 0.46, [symbol("B", scale * 0.6, phase - 1.67)], 0.65);
					result.push(
						symbol("+", 0.08 * math.sin(phase)),
						symbol("^", 0.045),
						symbol("B", scale * 0.8, phase + 0.54),
					);
					return result;
				},
			},
		],
		branchOpenSymbol: "[",
		branchCloseSymbol: "]",
	};
	return createBotanicalPreset(
		"bush",
		"A low multi-stem shrub built from six basal axes and recursively compact lateral fill.",
		grammar,
		{ leaf: true, step: 0.55, width: 0.14, widthDecay: 0.82 },
	);
}

/** A persistent leader emits successively younger whorls whose axes extend laterally. */
function createConiferPreset(): ModelSpecification {
	const grammar: GrammarSpec = {
		alphabet: moduleAlphabet([
			{ id: "C", parameterTypes: ["number", "number"] },
			{ id: "P", parameterTypes: ["number", "number"] },
		]),
		axiom: [symbol("C", 1, 0)],
		productions: [
			{
				id: "raise-conifer-leader-and-whorl",
				predecessor: "C",
				successor: (context) => {
					const scale = numericParameter(context, 0, 1);
					const phase = numericParameter(context, 1, 0);
					const result = new Array<ModuleSymbol>();
					result.push(symbol("F", 1.2 * scale));
					for (let index = 0; index < 4; index++) {
						const roll = phase + (index / 4) * math.pi * 2;
						appendBranch(result, roll, 0.94 + (index % 2) * 0.06, [symbol("P", scale * 0.6, roll)], 0.66);
					}
					result.push(symbol("C", scale * 0.88, phase + 0.47));
					return result;
				},
			},
			{
				id: "extend-conifer-plagiotropic-axis",
				predecessor: "P",
				successor: (context) => {
					const scale = numericParameter(context, 0, 1);
					const phase = numericParameter(context, 1, 0);
					const result = new Array<ModuleSymbol>();
					result.push(symbol("F", 0.82 * scale));
					appendBranch(result, 2.06, 0.34, [symbol("F", 0.34 * scale), symbol("L")], 0.58);
					appendBranch(result, -2.06, 0.31, [symbol("F", 0.3 * scale), symbol("L")], 0.56);
					result.push(symbol("+", 0.04 * math.sin(phase)), symbol("P", scale * 0.73, phase + 0.61));
					return result;
				},
			},
		],
		branchOpenSymbol: "[",
		branchCloseSymbol: "]",
	};
	return createBotanicalPreset(
		"conifer",
		"A conical dominant-leader tree with tiered four-fold whorls and tapered plagiotropic axes.",
		grammar,
		{ leaf: true, step: 0.9, width: 0.22, widthDecay: 0.78 },
	);
}

/** A clear bole supports a recursively divided, radially distributed crown. */
function createBroadCanopyTreePreset(): ModelSpecification {
	const grammar: GrammarSpec = {
		alphabet: moduleAlphabet([{ id: "R", parameterTypes: ["number", "number"] }]),
		axiom: [symbol("F", 1.35), symbol("F", 1.15), symbol("F", 0.95), symbol("R", 1, 0)],
		productions: [
			{
				id: "divide-rounded-crown",
				predecessor: "R",
				successor: (context) => {
					const scale = numericParameter(context, 0, 1);
					const phase = numericParameter(context, 1, 0);
					const result = new Array<ModuleSymbol>();
					result.push(symbol("F", 0.82 * scale));
					for (let index = 0; index < 4; index++) {
						const roll = phase + (index / 4) * math.pi * 2;
						const inclination = index % 2 === 0 ? 0.86 : 1.04;
						appendBranch(
							result,
							roll,
							inclination,
							[symbol("R", scale * (index % 2 === 0 ? 0.8 : 0.75), roll + 0.38)],
							0.7,
						);
					}
					return result;
				},
			},
		],
		branchOpenSymbol: "[",
		branchCloseSymbol: "]",
	};
	return createBotanicalPreset(
		"broad-canopy-tree",
		"A clear-bole tree with a radially dividing, rounded crown and no competing basal axes.",
		grammar,
		{ leaf: true, step: 1.2, width: 0.3, widthDecay: 0.84, radialResolution: 10 },
	);
}

/** A persistent, alternating main axis curves in 3D and emits narrow tendrils. */
function createVinePreset(): ModelSpecification {
	const grammar: GrammarSpec = {
		alphabet: moduleAlphabet([{ id: "V", parameterTypes: ["number", "number", "number"] }]),
		axiom: [symbol("V", 1, 0, 1)],
		productions: [
			{
				id: "curve-vine-and-emit-tendril",
				predecessor: "V",
				successor: (context) => {
					const scale = numericParameter(context, 0, 1);
					const phase = numericParameter(context, 1, 0);
					const turn = numericParameter(context, 2, 1);
					const result = new Array<ModuleSymbol>();
					result.push(
						symbol("F", 0.76 * scale),
						symbol("+", 0.3 * turn),
						symbol("\\", 0.16 * turn),
						symbol("F", 0.64 * scale),
					);
					appendBranch(
						result,
						phase,
						0.98,
						[symbol("F", 0.42 * scale), symbol("+", 0.72 * turn), symbol("F", 0.26 * scale), symbol("L")],
						0.48,
					);
					result.push(
						symbol("+", 0.2 * turn),
						symbol("^", 0.16 * turn),
						symbol("V", scale * 0.96, phase + GOLDEN_ANGLE, -turn),
					);
					return result;
				},
			},
		],
		branchOpenSymbol: "[",
		branchCloseSymbol: "]",
	};
	return createBotanicalPreset(
		"vine",
		"A slender alternating 3D vine with a persistent curved axis and successively rotated tendrils.",
		grammar,
		{ leaf: true, step: 0.5, width: 0.075, widthDecay: 0.92 },
	);
}

function branchingSuccessor(
	angle: number,
	variants: number,
	includeLeaf: boolean,
	includeFlower: boolean,
): readonly ModuleSymbol[] {
	const result = new Array<ModuleSymbol>();
	result.push(symbol("F"));
	for (let index = 0; index < variants; index++) {
		const yaw = index % 2 === 0 ? angle : -angle;
		result.push(
			symbol("["),
			symbol("!", 0.8),
			symbol(index % 3 === 0 ? "\\" : "/", angle),
			symbol(yaw >= 0 ? "+" : "-", math.abs(yaw)),
			symbol("A"),
		);
		if (includeLeaf) result.push(symbol("L"));
		result.push(symbol("]"));
	}
	if (includeFlower) result.push(symbol("K"));
	result.push(symbol("A"));
	return result;
}

function createPreset(
	id: string,
	description: string,
	angle: number,
	branches: number,
	options: PresetOptions = {},
): ModelSpecification {
	return createBotanicalPreset(
		id,
		description,
		{
			alphabet: moduleAlphabet([{ id: "A" }]),
			axiom: [symbol("A")],
			productions: [
				{
					id: "grow",
					predecessor: "A",
					successor: branchingSuccessor(angle, branches, options.leaf === true, options.flower === true),
				},
			],
			branchOpenSymbol: "[",
			branchCloseSymbol: "]",
		},
		options,
	);
}

/** Curated mechanism-oriented model specifications. */
export const PLANT_PRESETS: Readonly<Record<string, ModelSpecification>> = {
	"flowering-stem": createFloweringStemPreset(),
	"branching-herb": createBranchingHerbPreset(),
	bush: createBushPreset(),
	conifer: createConiferPreset(),
	"broad-canopy-tree": createBroadCanopyTreePreset(),
	vine: createVinePreset(),
	"compound-leaf": createPreset("compound-leaf", "Rachis-like axis with repeated leaflet modules.", math.pi / 2, 1, {
		leaf: true,
		step: 0.35,
		width: 0.04,
	}),
	raceme: createPreset("raceme", "Monopodial flower sequence.", math.pi / 2.5, 1, {
		flower: true,
		step: 0.45,
		width: 0.06,
	}),
	"sympodial-flowering": createPreset("sympodial-flowering", "Forking cymose flowering form.", math.pi / 5, 2, {
		leaf: true,
		flower: true,
		step: 0.55,
	}),
	"phyllotactic-head": createPreset(
		"phyllotactic-head",
		"Stem for a separately placed phyllotactic flower head.",
		math.pi / 6,
		1,
		{ flower: true, step: 0.4 },
	),
	"root-like": createPreset("root-like", "Downward-oriented procedural root skeleton.", math.pi / 4, 3, {
		step: 0.7,
		widthDecay: 0.72,
	}),
	"botanical-arch": createPreset("botanical-arch", "Plant-derived arch skeleton.", math.pi / 10, 2, {
		leaf: true,
		step: 0.8,
		width: 0.2,
	}),
	"botanical-hut": createPreset("botanical-hut", "Radial plant-derived hut-frame skeleton.", math.pi / 3, 4, {
		step: 1,
		width: 0.24,
	}),
	"timed-tree": createPreset(
		"timed-tree",
		"Tree preset intended for absolute-time growth evaluation.",
		math.pi / 4,
		2,
		{ leaf: true, flower: true, step: 0.85 },
	),
};

/** Isolated preset registry supporting immutable extension. */
export class PresetRegistry {
	private readonly values: Record<string, ModelSpecification> = {};

	public constructor(includeBuiltIns = true) {
		if (includeBuiltIns) for (const [id, preset] of pairs(PLANT_PRESETS)) this.values[id] = preset;
	}

	/** Adds a specification under its stable ID. */
	public register(specification: ModelSpecification): void {
		assert(this.values[specification.id] === undefined, `preset ${specification.id} already exists`);
		this.values[specification.id] = specification;
	}

	/** Resolves a specification by its stable ID. */
	public get(id: string): ModelSpecification | undefined {
		return this.values[id];
	}

	/** Derives, registers, and returns a preset without mutating its parent. */
	public extend(parentId: string, id: string, overrides: Partial<ModelSpecification>): ModelSpecification {
		const parent = this.values[parentId];
		assert(parent !== undefined, `unknown parent preset ${parentId}`);
		const child = extendModelSpecification(parent, { ...overrides, id });
		this.register(child);
		return child;
	}

	/** Returns registered IDs in deterministic lexical order. */
	public ids(): readonly string[] {
		const result = new Array<string>();
		for (const [id] of pairs(this.values)) result.push(id);
		for (let index = 1; index < result.size(); index++) {
			const value = result[index];
			if (value === undefined) continue;
			let cursor = index - 1;
			while (cursor >= 0 && (result[cursor] ?? "") > value) {
				result[cursor + 1] = result[cursor] ?? "";
				cursor--;
			}
			result[cursor + 1] = value;
		}
		return result;
	}
}
