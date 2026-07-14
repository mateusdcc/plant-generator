import { Diagnostics, type Diagnostic } from "../core/diagnostics";
import { compileGrammar, type CompiledGrammar, type GrammarSpec, type ProductionSpec } from "../core/grammar";
import type { StructuredParameter, SymbolParameter } from "../core/symbols";
import type { JunctionMode } from "../geometry/tubes";
import type { TurtleCommandMapping } from "../turtle/interpreter";
import type { BehaviorRegistries } from "./registry";

/** Current model schema understood by this package. @public */
export const MODEL_SCHEMA_VERSION = 1;

/** Human-readable but serialization-safe model metadata. @public */
export interface ModelMetadata {
	readonly name?: string;
	readonly description?: string;
	readonly author?: string;
	readonly tags?: readonly string[];
}

/** Serializable turtle configuration. @public */
export interface TurtleConfiguration {
	readonly stepSize?: number;
	readonly angleRadians?: number;
	readonly initialWidth?: number;
	readonly widthDecay?: number;
	readonly mappings?: readonly TurtleCommandMapping[];
	readonly unknownSymbolPolicy?: "ignore" | "warn" | "error";
}

/** Serializable branch geometry controls. @public */
export interface GeometryConfiguration {
	readonly enabled?: boolean;
	readonly radialResolution?: number;
	readonly junctionMode?: JunctionMode;
	readonly capBranches?: boolean;
	readonly factoryId?: string;
}

/** Serializable organ placement controls. @public */
export interface OrganConfiguration {
	readonly terminalLeafKind?: string;
	readonly terminalFlowerKind?: string;
	readonly leafDensity?: number;
	readonly flowerDensity?: number;
	readonly factoryId?: string;
}

/** Serializable growth controls. @public */
export interface AnimationConfiguration {
	readonly duration?: number;
	readonly growthFunctionId?: string;
	readonly birthInterval?: number;
}

/** Serializable LOD controls. @public */
export interface LodConfiguration {
	readonly fullDistance?: number;
	readonly mediumDistance?: number;
	readonly lowDistance?: number;
	readonly mediumRadialResolution?: number;
	readonly lowRadialResolution?: number;
	readonly maxBranchDepthByLevel?: Readonly<Record<string, number>>;
}

/** Versioned, renderer-independent plant model specification. @public */
export interface ModelSpecification {
	readonly schemaVersion: number;
	readonly id: string;
	readonly version?: string;
	readonly metadata?: ModelMetadata;
	readonly grammar: GrammarSpec;
	readonly turtle?: TurtleConfiguration;
	readonly geometry?: GeometryConfiguration;
	readonly organs?: OrganConfiguration;
	readonly animation?: AnimationConfiguration;
	readonly lod?: LodConfiguration;
	readonly extensions?: StructuredParameter;
}

/** Reusable compiled model with all named callbacks resolved. @public */
export interface CompiledPlantModel {
	readonly specification: ModelSpecification;
	readonly grammar: CompiledGrammar;
	readonly hash: string;
	readonly registries?: BehaviorRegistries;
}

/** Structured compiler result for tolerant tooling. @public */
export interface PlantCompileResult {
	readonly model?: CompiledPlantModel;
	readonly diagnostics: readonly Diagnostic[];
}

function resolveProductions(
	productions: readonly ProductionSpec[],
	registries: BehaviorRegistries | undefined,
	diagnostics: Diagnostics,
): readonly ProductionSpec[] {
	const result = new Array<ProductionSpec>();
	for (const production of productions) {
		let successor = production.successor;
		let condition = production.condition;
		if (production.operationId !== undefined) {
			const operation = registries?.productionOperations.resolve(production.operationId);
			if (operation === undefined) {
				diagnostics.error("UNKNOWN_REGISTRY_ID", `Unknown production operation ${production.operationId}.`, {
					productionId: production.id,
				});
			} else successor = operation;
		}
		if (production.predicateId !== undefined) {
			const predicate = registries?.predicates.resolve(production.predicateId);
			if (predicate === undefined) {
				diagnostics.error("UNKNOWN_REGISTRY_ID", `Unknown predicate ${production.predicateId}.`, {
					productionId: production.id,
				});
			} else condition = predicate;
		}
		result.push({ ...production, successor, ...(condition === undefined ? {} : { condition }) });
	}
	return result;
}

/** Validates a versioned model and resolves named behaviors. @public */
export function compileModelSpecification(
	specification: ModelSpecification,
	registries?: BehaviorRegistries,
): PlantCompileResult {
	const diagnostics = new Diagnostics();
	if (specification.schemaVersion !== MODEL_SCHEMA_VERSION) {
		diagnostics.error(
			"UNSUPPORTED_SCHEMA_VERSION",
			`Schema version ${specification.schemaVersion} is unsupported; expected ${MODEL_SCHEMA_VERSION}.`,
			{ path: "schemaVersion" },
		);
		return { diagnostics: diagnostics.all() };
	}
	if (specification.id.size() === 0)
		diagnostics.error("INVALID_PARAMETER", "Model id must not be empty.", { path: "id" });
	const resolvedGrammar: GrammarSpec = {
		...specification.grammar,
		productions: resolveProductions(specification.grammar.productions, registries, diagnostics),
	};
	const grammarResult = compileGrammar(resolvedGrammar);
	for (const diagnostic of grammarResult.diagnostics) diagnostics.add(diagnostic);
	if (diagnostics.hasErrors() || grammarResult.grammar === undefined) return { diagnostics: diagnostics.all() };
	const resolvedSpecification: ModelSpecification = { ...specification, grammar: resolvedGrammar };
	return {
		model: {
			specification: resolvedSpecification,
			grammar: grammarResult.grammar,
			hash: hashModelSpecification(specification),
			...(registries === undefined ? {} : { registries }),
		},
		diagnostics: diagnostics.all(),
	};
}

/** Stable hash for generation parameter overrides and mutation data. @public */
export function hashSymbolParameters(parameters: Readonly<Record<string, SymbolParameter>>): string {
	let hash = 2166136261;
	const keys = new Array<string>();
	for (const [key] of pairs(parameters)) keys.push(key);
	for (let index = 1; index < keys.size(); index++) {
		const value = keys[index];
		if (value === undefined) continue;
		let cursor = index - 1;
		while (cursor >= 0 && (keys[cursor] ?? "") > value) {
			keys[cursor + 1] = keys[cursor] ?? "";
			cursor--;
		}
		keys[cursor + 1] = value;
	}
	for (const key of keys) {
		hash = hashText(hash, key);
		const value = parameters[key];
		if (value !== undefined) hash = hashParameter(hash, value);
	}
	return `${hash}`;
}

function mix(hash: number, value: number): number {
	let result = hash ^ (value >>> 0);
	result = (result + (result << 1) + (result << 4) + (result << 7) + (result << 8) + (result << 24)) >>> 0;
	return result;
}

function hashText(hash: number, value: string): number {
	let result = hash;
	for (let index = 1; index <= value.size(); index++) result = mix(result, string.byte(value, index, index)[0] ?? 0);
	return result;
}

function hashParameter(hash: number, value: SymbolParameter): number {
	const kind = typeOf(value);
	let result = hashText(hash, kind);
	if (kind === "number") return mix(result, math.floor((value as number) * 1_000_000));
	if (kind === "string") return hashText(result, value as string);
	if (kind === "boolean") return mix(result, value === true ? 1 : 0);
	for (const [key, child] of pairs(value as Readonly<Record<string | number, SymbolParameter>>)) {
		result = hashText(result, `${key}`);
		result = hashParameter(result, child);
	}
	return result;
}

/** Stable deterministic hash of a model's generation-relevant data. @public */
export function hashModelSpecification(specification: ModelSpecification): string {
	let hash = hashText(2166136261, specification.id);
	hash = mix(hash, specification.schemaVersion);
	for (const value of specification.grammar.axiom) {
		hash = hashText(hash, `${value.id}`);
		for (const parameter of value.parameters) hash = hashParameter(hash, parameter);
	}
	for (const production of specification.grammar.productions) {
		hash = hashText(hash, production.id);
		hash = hashText(hash, `${production.predecessor}`);
		hash = mix(hash, math.floor((production.weight ?? 1) * 1_000_000));
		hash = hashText(hash, production.operationId ?? "");
		hash = hashText(hash, production.predicateId ?? "");
		if (!typeIs(production.successor, "function")) {
			for (const value of production.successor) {
				hash = hashText(hash, `${value.id}`);
				for (const parameter of value.parameters) hash = hashParameter(hash, parameter);
			}
		}
	}
	return `${hash}`;
}

/** Immutably extends a model with explicit deep overrides for configuration groups. @public */
export function extendModelSpecification(
	base: ModelSpecification,
	overrides: Partial<ModelSpecification>,
): ModelSpecification {
	return {
		...base,
		...overrides,
		metadata: { ...base.metadata, ...overrides.metadata },
		grammar: overrides.grammar ?? base.grammar,
		turtle: { ...base.turtle, ...overrides.turtle },
		geometry: { ...base.geometry, ...overrides.geometry },
		organs: { ...base.organs, ...overrides.organs },
		animation: { ...base.animation, ...overrides.animation },
		lod: { ...base.lod, ...overrides.lod },
		extensions: { ...base.extensions, ...overrides.extensions },
	};
}

/** Migrates a legacy schema-0 data shape to the current model schema. @public */
export function migrateModelSpecification(
	input: ModelSpecification | (Omit<ModelSpecification, "schemaVersion"> & { schemaVersion?: 0 }),
): ModelSpecification {
	if (input.schemaVersion === MODEL_SCHEMA_VERSION) return input as ModelSpecification;
	assert(input.schemaVersion === undefined || input.schemaVersion === 0, "unsupported model schema version");
	return { ...input, schemaVersion: MODEL_SCHEMA_VERSION };
}
