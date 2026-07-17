import { Diagnostics, type Diagnostic } from "../core/diagnostics";
import { compileGrammar, type CompiledGrammar, type GrammarSpec, type ProductionSpec } from "../core/grammar";
import type { ModuleSymbol, StructuredParameter, SymbolId, SymbolParameter } from "../core/symbols";
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
	/** Process-local salt that prevents callback-backed models from sharing unsafe cache entries. @internal */
	readonly runtimeCacheIdentity?: number;
	readonly registries?: BehaviorRegistries;
}

/** Structured compiler result for tolerant tooling. @public */
export interface PlantCompileResult {
	readonly model?: CompiledPlantModel;
	readonly diagnostics: readonly Diagnostic[];
}

let nextRuntimeCacheIdentity = 1;

function usesRuntimeBehavior(
	specification: ModelSpecification,
	grammar: GrammarSpec,
	registries: BehaviorRegistries | undefined,
): boolean {
	for (const production of grammar.productions) {
		if (typeIs(production.successor, "function") || production.condition !== undefined) return true;
	}
	const geometryFactoryId = specification.geometry?.factoryId;
	return geometryFactoryId !== undefined && registries?.geometryFactories.resolve(geometryFactoryId) !== undefined;
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
	const runtimeBehavior = usesRuntimeBehavior(resolvedSpecification, resolvedGrammar, registries);
	return {
		model: {
			specification: resolvedSpecification,
			grammar: grammarResult.grammar,
			hash: hashModelSpecification(specification),
			...(runtimeBehavior ? { runtimeCacheIdentity: nextRuntimeCacheIdentity++ } : {}),
			...(registries === undefined ? {} : { registries }),
		},
		diagnostics: diagnostics.all(),
	};
}

/** Stable hash for generation parameter overrides and mutation data. @public */
export function hashSymbolParameters(parameters: Readonly<Record<string, SymbolParameter>>): string {
	let hash = hashText(2166136261, "symbol-parameters-v2;");
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
	hash = mix(hash, keys.size());
	for (const key of keys) {
		hash = hashScalar(hash, key);
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

function hashScalar(hash: number, value: string | number | boolean | undefined): number {
	if (value === undefined) return hashText(hash, "undefined;");
	let result = hashText(hash, `${typeOf(value)};`);
	const text = `${value}`;
	result = mix(result, text.size());
	return hashText(result, text);
}

interface ParameterEntry {
	readonly key: string;
	readonly value: SymbolParameter;
}

function sortParameterEntries(values: ParameterEntry[]): void {
	for (let index = 1; index < values.size(); index++) {
		const value = values[index];
		if (value === undefined) continue;
		let cursor = index - 1;
		while (cursor >= 0 && (values[cursor]?.key ?? "") > value.key) {
			values[cursor + 1] = values[cursor] as ParameterEntry;
			cursor--;
		}
		values[cursor + 1] = value;
	}
}

function hashParameter(hash: number, value: SymbolParameter): number {
	const kind = typeOf(value);
	if (kind === "number" || kind === "string" || kind === "boolean") {
		return hashScalar(hash, value as number | string | boolean);
	}
	let result = hashText(hash, "table;");
	const entries = new Array<ParameterEntry>();
	for (const [key, child] of pairs(value as Readonly<Record<string | number, SymbolParameter>>))
		entries.push({ key: `${key}`, value: child });
	sortParameterEntries(entries);
	result = mix(result, entries.size());
	for (const entry of entries) {
		result = hashScalar(result, entry.key);
		result = hashParameter(result, entry.value);
	}
	return result;
}

function hashModule(hash: number, value: ModuleSymbol): number {
	let result = hashScalar(hash, value.id);
	result = mix(result, value.parameters.size());
	for (const parameter of value.parameters) result = hashParameter(result, parameter);
	result = hashScalar(result, value.birthTime);
	result = hashScalar(result, value.trace === undefined ? undefined : "trace");
	if (value.trace !== undefined) {
		result = hashScalar(result, value.trace.generation);
		result = hashScalar(result, value.trace.sourceIndex);
		result = hashScalar(result, value.trace.productionId);
	}
	return result;
}

function hashModules(hash: number, values: readonly ModuleSymbol[]): number {
	let result = mix(hash, values.size());
	for (const value of values) result = hashModule(result, value);
	return result;
}

function hashSymbolIds(hash: number, values: readonly SymbolId[] | undefined): number {
	let result = hashScalar(hash, values?.size());
	if (values !== undefined) for (const value of values) result = hashScalar(result, value);
	return result;
}

/**
 * Stable deterministic hash of a model's declarative generation-relevant data.
 *
 * @remarks Callback implementations cannot be represented portably across JS
 * and Luau. Their declared IDs and model version participate in this public
 * hash, while compiled models receive a process-local cache salt so distinct
 * inline callbacks cannot alias one another in a shared generation cache.
 * @public
 */
export function hashModelSpecification(specification: ModelSpecification): string {
	let hash = hashText(2166136261, "model-specification-v2;");
	hash = hashScalar(hash, specification.schemaVersion);
	hash = hashScalar(hash, specification.id);
	hash = hashScalar(hash, specification.version);

	const grammar = specification.grammar;
	hash = mix(hash, grammar.alphabet.size());
	for (const entry of grammar.alphabet) {
		hash = hashScalar(hash, entry.id);
		hash = hashScalar(hash, entry.parameterTypes?.size());
		if (entry.parameterTypes !== undefined)
			for (const parameterType of entry.parameterTypes) hash = hashScalar(hash, parameterType);
	}
	hash = hashModules(hash, grammar.axiom);
	hash = mix(hash, grammar.productions.size());
	for (const production of grammar.productions) {
		hash = hashScalar(hash, production.id);
		hash = hashScalar(hash, production.predecessor);
		hash = hashSymbolIds(hash, production.leftContext);
		hash = hashSymbolIds(hash, production.rightContext);
		hash = hashSymbolIds(hash, production.ignoreSymbols);
		hash = hashScalar(hash, production.weight);
		hash = hashScalar(hash, production.priority);
		hash = hashScalar(hash, production.contextMode);
		hash = hashScalar(hash, production.predicateId);
		hash = hashScalar(hash, production.operationId);
		hash = hashScalar(hash, production.condition === undefined ? undefined : "runtime-condition");
		if (typeIs(production.successor, "function")) hash = hashScalar(hash, "runtime-successor");
		else hash = hashModules(hash, production.successor);
	}
	hash = hashScalar(hash, grammar.branchOpenSymbol);
	hash = hashScalar(hash, grammar.branchCloseSymbol);

	const turtle = specification.turtle;
	hash = hashScalar(hash, turtle === undefined ? undefined : "turtle");
	if (turtle !== undefined) {
		hash = hashScalar(hash, turtle.stepSize);
		hash = hashScalar(hash, turtle.angleRadians);
		hash = hashScalar(hash, turtle.initialWidth);
		hash = hashScalar(hash, turtle.widthDecay);
		hash = hashScalar(hash, turtle.unknownSymbolPolicy);
		hash = hashScalar(hash, turtle.mappings?.size());
		if (turtle.mappings !== undefined) {
			for (const mapping of turtle.mappings) {
				hash = hashScalar(hash, mapping.symbol);
				hash = hashScalar(hash, mapping.action);
			}
		}
	}

	const geometry = specification.geometry;
	hash = hashScalar(hash, geometry === undefined ? undefined : "geometry");
	if (geometry !== undefined) {
		hash = hashScalar(hash, geometry.enabled);
		hash = hashScalar(hash, geometry.radialResolution);
		hash = hashScalar(hash, geometry.junctionMode);
		hash = hashScalar(hash, geometry.capBranches);
		hash = hashScalar(hash, geometry.factoryId);
	}

	const organs = specification.organs;
	hash = hashScalar(hash, organs === undefined ? undefined : "organs");
	if (organs !== undefined) {
		hash = hashScalar(hash, organs.terminalLeafKind);
		hash = hashScalar(hash, organs.terminalFlowerKind);
		hash = hashScalar(hash, organs.leafDensity);
		hash = hashScalar(hash, organs.flowerDensity);
		hash = hashScalar(hash, organs.factoryId);
	}

	const animation = specification.animation;
	hash = hashScalar(hash, animation === undefined ? undefined : "animation");
	if (animation !== undefined) {
		hash = hashScalar(hash, animation.duration);
		hash = hashScalar(hash, animation.growthFunctionId);
		hash = hashScalar(hash, animation.birthInterval);
	}

	const lod = specification.lod;
	hash = hashScalar(hash, lod === undefined ? undefined : "lod");
	if (lod !== undefined) {
		hash = hashScalar(hash, lod.fullDistance);
		hash = hashScalar(hash, lod.mediumDistance);
		hash = hashScalar(hash, lod.lowDistance);
		hash = hashScalar(hash, lod.mediumRadialResolution);
		hash = hashScalar(hash, lod.lowRadialResolution);
		hash = hashScalar(hash, lod.maxBranchDepthByLevel === undefined ? undefined : "depths");
		if (lod.maxBranchDepthByLevel !== undefined)
			hash = hashParameter(hash, lod.maxBranchDepthByLevel as StructuredParameter);
	}

	hash = hashScalar(hash, specification.extensions === undefined ? undefined : "extensions");
	if (specification.extensions !== undefined) hash = hashParameter(hash, specification.extensions);
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
