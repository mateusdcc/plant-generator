import { symbol, type ModuleSymbol } from "../core/symbols";
import { extendModelSpecification, MODEL_SCHEMA_VERSION, type ModelSpecification } from "../runtime/specification";

const alphabet = ["A", "F", "f", "+", "-", "^", "&", "\\", "/", "[", "]", "!", "L", "K"];

function moduleAlphabet() {
	const result = new Array<{ id: string }>();
	for (const id of alphabet) result.push({ id });
	return result;
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
	options: {
		readonly leaf?: boolean;
		readonly flower?: boolean;
		readonly radialResolution?: number;
		readonly step?: number;
		readonly width?: number;
		readonly widthDecay?: number;
	} = {},
): ModelSpecification {
	return {
		schemaVersion: MODEL_SCHEMA_VERSION,
		id,
		version: "0.1.0",
		metadata: { name: id, description, tags: ["preset", "botanical"] },
		grammar: {
			alphabet: moduleAlphabet(),
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
		turtle: {
			stepSize: options.step ?? 1,
			angleRadians: angle,
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

/** Curated mechanism-oriented model specifications. @public */
export const PLANT_PRESETS: Readonly<Record<string, ModelSpecification>> = {
	"flowering-stem": createPreset("flowering-stem", "A small monopodial flowering stem.", math.pi / 5, 1, {
		leaf: true,
		flower: true,
		step: 0.7,
	}),
	"branching-herb": createPreset("branching-herb", "A branching herb with lateral leaves.", math.pi / 4, 2, {
		leaf: true,
		flower: true,
		step: 0.6,
	}),
	bush: createPreset("bush", "Dense bounded shrub topology.", math.pi / 3.5, 3, {
		leaf: true,
		step: 0.55,
		width: 0.14,
	}),
	conifer: createPreset("conifer", "Narrow conifer-like recursive branching.", math.pi / 7, 3, {
		leaf: true,
		step: 0.9,
		widthDecay: 0.76,
	}),
	"broad-canopy-tree": createPreset("broad-canopy-tree", "Broad recursive tree canopy.", math.pi / 3, 3, {
		leaf: true,
		step: 1.2,
		width: 0.28,
		radialResolution: 10,
	}),
	vine: createPreset("vine", "Flexible vine-like branching system.", math.pi / 6, 1, {
		leaf: true,
		step: 0.5,
		width: 0.08,
	}),
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

/** Isolated preset registry supporting immutable extension. @public */
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

	/** Resolves a preset by stable ID. */
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
