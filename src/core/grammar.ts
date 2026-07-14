import { Diagnostics, type Diagnostic } from "./diagnostics";
import { SymbolWord, type ModuleSymbol, type SymbolId, type SymbolParameter, countSymbols } from "./symbols";
import { XorShift32, selectWeightedIndex, type RandomSource } from "../math/random";
import {
	DEFAULT_LIMITS,
	NEVER_CANCELLED,
	WorkBudget,
	type CancellationToken,
	type GenerationLimits,
} from "../runtime/limits";

/** Plain-data alphabet declaration. @public */
export interface AlphabetSymbolSpec {
	readonly id: SymbolId;
	readonly parameterTypes?: readonly ("number" | "boolean" | "string" | "vector" | "structured")[];
}

/** Context exposed to production guards and parametric successors. @public */
export interface ProductionContext {
	readonly symbol: ModuleSymbol;
	readonly index: number;
	readonly generation: number;
	readonly word: readonly ModuleSymbol[];
	readonly globalParameters: Readonly<Record<string, SymbolParameter>>;
	readonly random: RandomSource;
}

/** Predicate used by conditional or parametric productions. @public */
export type ProductionPredicate = (context: ProductionContext) => boolean;

/** Successor factory used by parametric productions. @public */
export type ProductionSuccessor = (context: ProductionContext) => readonly ModuleSymbol[];

/** A context-free, context-sensitive, stochastic, or parametric production. @public */
export interface ProductionSpec {
	readonly id: string;
	readonly predecessor: SymbolId;
	readonly successor: readonly ModuleSymbol[] | ProductionSuccessor;
	readonly leftContext?: readonly SymbolId[];
	readonly rightContext?: readonly SymbolId[];
	readonly ignoreSymbols?: readonly SymbolId[];
	readonly condition?: ProductionPredicate;
	readonly predicateId?: string;
	readonly operationId?: string;
	readonly weight?: number;
	readonly priority?: number;
	readonly contextMode?: "linear" | "axial";
}

/** Serializable grammar declaration plus optional compiled callbacks. @public */
export interface GrammarSpec {
	readonly alphabet: readonly AlphabetSymbolSpec[];
	readonly axiom: readonly ModuleSymbol[];
	readonly productions: readonly ProductionSpec[];
	readonly branchOpenSymbol?: SymbolId;
	readonly branchCloseSymbol?: SymbolId;
}

interface CompiledProduction {
	readonly spec: ProductionSpec;
	readonly specificity: number;
}

/** Reusable production index produced by grammar compilation. @public */
export interface CompiledGrammar {
	readonly spec: GrammarSpec;
	readonly productionIndex: Readonly<
		Record<string, readonly { readonly spec: ProductionSpec; readonly specificity: number }[]>
	>;
	readonly alphabetIndex: Readonly<Record<string, AlphabetSymbolSpec>>;
}

/** Non-throwing grammar compilation result. @public */
export interface GrammarCompileResult {
	readonly grammar?: CompiledGrammar;
	readonly diagnostics: readonly Diagnostic[];
}

/** Optional derivation lifecycle observer. @public */
export interface GenerationObserver {
	/** Called once before the first parallel rewrite. */
	onDerivationStarted?(word: readonly ModuleSymbol[]): void;
	/** Called for each source symbol after its successor is selected. */
	onSymbolRewritten?(source: ModuleSymbol, successor: readonly ModuleSymbol[], productionId?: string): void;
	/** Called after a complete generation has been assembled. */
	onGenerationStep?(generation: number, symbolCount: number, workUnits: number): void;
	/** Called after synchronous derivation completes. */
	onDerivationCompleted?(result: DerivationResult): void;
	/** Called when cooperative cancellation stops generation. */
	onGenerationCancelled?(): void;
}

/** Controls bounded deterministic parallel rewriting. @public */
export interface DerivationOptions {
	readonly iterations: number;
	readonly seed?: number;
	readonly random?: RandomSource;
	readonly limits?: Partial<GenerationLimits>;
	readonly globalParameters?: Readonly<Record<string, SymbolParameter>>;
	readonly trace?: boolean;
	readonly includeHistory?: boolean;
	readonly strict?: boolean;
	readonly cancellation?: CancellationToken;
	readonly observer?: GenerationObserver;
}

/** Rewriting counters independent of wall-clock time. @public */
export interface DerivationStatistics {
	readonly iterationsCompleted: number;
	readonly symbols: number;
	readonly workUnits: number;
	readonly truncated: boolean;
	readonly symbolCounts: Readonly<Record<string, number>>;
}

/** Complete or bounded-partial derivation output. @public */
export interface DerivationResult {
	readonly word: readonly ModuleSymbol[];
	readonly history?: readonly (readonly ModuleSymbol[])[];
	readonly diagnostics: readonly Diagnostic[];
	readonly statistics: DerivationStatistics;
	readonly randomState: number;
}

function keyOf(id: SymbolId): string {
	return `${typeOf(id)}:${id}`;
}

function includesId(values: readonly SymbolId[] | undefined, id: SymbolId): boolean {
	if (values === undefined) return false;
	const key = keyOf(id);
	for (const value of values) if (keyOf(value) === key) return true;
	return false;
}

function mergeLimits(overrides: Partial<GenerationLimits> | undefined): GenerationLimits {
	return {
		maxIterations: overrides?.maxIterations ?? DEFAULT_LIMITS.maxIterations,
		maxSymbols: overrides?.maxSymbols ?? DEFAULT_LIMITS.maxSymbols,
		maxBranchDepth: overrides?.maxBranchDepth ?? DEFAULT_LIMITS.maxBranchDepth,
		maxStackDepth: overrides?.maxStackDepth ?? DEFAULT_LIMITS.maxStackDepth,
		maxSegments: overrides?.maxSegments ?? DEFAULT_LIMITS.maxSegments,
		maxOrgans: overrides?.maxOrgans ?? DEFAULT_LIMITS.maxOrgans,
		maxVertices: overrides?.maxVertices ?? DEFAULT_LIMITS.maxVertices,
		maxTriangles: overrides?.maxTriangles ?? DEFAULT_LIMITS.maxTriangles,
		maxWorkUnits: overrides?.maxWorkUnits ?? DEFAULT_LIMITS.maxWorkUnits,
		maxRenderedInstances: overrides?.maxRenderedInstances ?? DEFAULT_LIMITS.maxRenderedInstances,
	};
}

function validateBrackets(spec: GrammarSpec, diagnostics: Diagnostics): void {
	if (spec.branchOpenSymbol === undefined || spec.branchCloseSymbol === undefined) return;
	let depth = 0;
	for (let index = 0; index < spec.axiom.size(); index++) {
		const id = spec.axiom[index]?.id;
		if (id === undefined) continue;
		if (keyOf(id) === keyOf(spec.branchOpenSymbol)) depth++;
		if (keyOf(id) === keyOf(spec.branchCloseSymbol)) depth--;
		if (depth < 0) {
			diagnostics.error("UNBALANCED_BRANCH", "Axiom closes a branch before one is opened.", {
				symbolIndex: index,
			});
			return;
		}
	}
	if (depth !== 0) diagnostics.error("UNBALANCED_BRANCH", "Axiom contains an unclosed branch.");
}

/**
 * Validates and indexes productions once for reuse.
 *
 * @remarks Context-sensitive productions are ordered before context-free rules,
 * following the precedence expected by axial signal-propagation models.
 * @public
 */
export function compileGrammar(spec: GrammarSpec): GrammarCompileResult {
	const diagnostics = new Diagnostics();
	const alphabetIndex: Record<string, AlphabetSymbolSpec> = {};
	for (const entry of spec.alphabet) {
		const key = keyOf(entry.id);
		if (alphabetIndex[key] !== undefined)
			diagnostics.error("INVALID_GRAMMAR", `Duplicate alphabet symbol ${entry.id}.`);
		alphabetIndex[key] = entry;
	}
	for (let index = 0; index < spec.axiom.size(); index++) {
		const value = spec.axiom[index];
		if (value !== undefined && alphabetIndex[keyOf(value.id)] === undefined) {
			diagnostics.error("INVALID_GRAMMAR", `Axiom contains undeclared symbol ${value.id}.`, {
				symbolIndex: index,
			});
		}
	}
	validateBrackets(spec, diagnostics);
	const mutableIndex: Record<string, CompiledProduction[]> = {};
	const seenIds: Record<string, boolean> = {};
	for (const production of spec.productions) {
		if (seenIds[production.id] === true) {
			diagnostics.error("INVALID_GRAMMAR", `Duplicate production id ${production.id}.`, {
				productionId: production.id,
			});
		}
		seenIds[production.id] = true;
		if (alphabetIndex[keyOf(production.predecessor)] === undefined) {
			diagnostics.error("INVALID_GRAMMAR", `Production ${production.id} has an undeclared predecessor.`, {
				productionId: production.id,
			});
		}
		if (production.weight !== undefined && (!(production.weight > 0) || production.weight !== production.weight)) {
			diagnostics.error("INVALID_WEIGHT", `Production ${production.id} must have a positive finite weight.`, {
				productionId: production.id,
			});
		}
		const key = keyOf(production.predecessor);
		const group = mutableIndex[key] ?? [];
		group.push({
			spec: production,
			specificity: (production.leftContext?.size() ?? 0) + (production.rightContext?.size() ?? 0),
		});
		mutableIndex[key] = group;
	}
	for (const [, group] of pairs(mutableIndex)) {
		for (let index = 1; index < group.size(); index++) {
			const value = group[index];
			if (value === undefined) continue;
			let cursor = index - 1;
			while (cursor >= 0) {
				const previous = group[cursor];
				if (previous === undefined) break;
				const before =
					value.specificity > previous.specificity ||
					(value.specificity === previous.specificity &&
						(value.spec.priority ?? 0) > (previous.spec.priority ?? 0));
				if (!before) break;
				group[cursor + 1] = previous;
				cursor--;
			}
			group[cursor + 1] = value;
		}
		for (let index = 1; index < group.size(); index++) {
			const previous = group[index - 1];
			const current = group[index];
			if (
				previous !== undefined &&
				current !== undefined &&
				previous.specificity === current.specificity &&
				(previous.spec.priority ?? 0) === (current.spec.priority ?? 0) &&
				previous.spec.weight === undefined &&
				current.spec.weight === undefined
			) {
				diagnostics.warn(
					"AMBIGUOUS_PRODUCTION",
					`Productions ${previous.spec.id} and ${current.spec.id} share precedence; declaration order resolves ties.`,
				);
			}
		}
	}
	if (diagnostics.hasErrors()) return { diagnostics: diagnostics.all() };
	return { grammar: { spec, productionIndex: mutableIndex, alphabetIndex }, diagnostics: diagnostics.all() };
}

function stepOverBranch(
	word: readonly ModuleSymbol[],
	index: number,
	direction: -1 | 1,
	open: SymbolId | undefined,
	close: SymbolId | undefined,
): number {
	if (open === undefined || close === undefined) return index;
	const value = word[index];
	if (value === undefined) return index;
	if (direction === 1 && keyOf(value.id) === keyOf(open)) {
		let depth = 1;
		for (let cursor = index + 1; cursor < word.size(); cursor++) {
			const id = word[cursor]?.id;
			if (id === undefined) continue;
			if (keyOf(id) === keyOf(open)) depth++;
			if (keyOf(id) === keyOf(close)) depth--;
			if (depth === 0) return cursor;
		}
	}
	if (direction === -1 && keyOf(value.id) === keyOf(close)) {
		let depth = 1;
		for (let cursor = index - 1; cursor >= 0; cursor--) {
			const id = word[cursor]?.id;
			if (id === undefined) continue;
			if (keyOf(id) === keyOf(close)) depth++;
			if (keyOf(id) === keyOf(open)) depth--;
			if (depth === 0) return cursor;
		}
	}
	return index;
}

function matchSide(
	word: readonly ModuleSymbol[],
	startIndex: number,
	pattern: readonly SymbolId[] | undefined,
	direction: -1 | 1,
	production: ProductionSpec,
	grammar: CompiledGrammar,
): boolean {
	if (pattern === undefined || pattern.size() === 0) return true;
	let cursor = startIndex + direction;
	let patternIndex = direction === 1 ? 0 : pattern.size() - 1;
	while (patternIndex >= 0 && patternIndex < pattern.size()) {
		while (cursor >= 0 && cursor < word.size()) {
			if (production.contextMode === "axial") {
				const stepped = stepOverBranch(
					word,
					cursor,
					direction,
					grammar.spec.branchOpenSymbol,
					grammar.spec.branchCloseSymbol,
				);
				if (stepped !== cursor) {
					cursor = stepped + direction;
					continue;
				}
			}
			const candidate = word[cursor];
			if (candidate !== undefined && !includesId(production.ignoreSymbols, candidate.id)) break;
			cursor += direction;
		}
		if (cursor < 0 || cursor >= word.size()) return false;
		const expected = pattern[patternIndex];
		const candidate = word[cursor];
		if (expected === undefined || candidate === undefined || keyOf(expected) !== keyOf(candidate.id)) return false;
		cursor += direction;
		patternIndex += direction;
	}
	return true;
}

function chooseProduction(
	grammar: CompiledGrammar,
	word: readonly ModuleSymbol[],
	index: number,
	generation: number,
	globalParameters: Readonly<Record<string, SymbolParameter>>,
	random: RandomSource,
): CompiledProduction | undefined {
	const current = word[index];
	if (current === undefined) return undefined;
	const group = grammar.productionIndex[keyOf(current.id)];
	if (group === undefined) return undefined;
	const eligible = new Array<CompiledProduction>();
	let selectedSpecificity = -1;
	let selectedPriority = -math.huge;
	for (const production of group) {
		const priority = production.spec.priority ?? 0;
		if (eligible.size() > 0 && (production.specificity < selectedSpecificity || priority < selectedPriority)) break;
		if (!matchSide(word, index, production.spec.leftContext, -1, production.spec, grammar)) continue;
		if (!matchSide(word, index, production.spec.rightContext, 1, production.spec, grammar)) continue;
		const context: ProductionContext = { symbol: current, index, generation, word, globalParameters, random };
		if (production.spec.condition !== undefined && !production.spec.condition(context)) continue;
		if (eligible.size() === 0) {
			selectedSpecificity = production.specificity;
			selectedPriority = priority;
		}
		eligible.push(production);
	}
	if (eligible.size() === 0) return undefined;
	let stochastic = false;
	for (const value of eligible) if (value.spec.weight !== undefined) stochastic = true;
	if (!stochastic) return eligible[0];
	const weights = new Array<number>();
	for (const value of eligible) weights.push(value.spec.weight ?? 1);
	return eligible[selectWeightedIndex(weights, random)];
}

function withTrace(
	successor: readonly ModuleSymbol[],
	trace: boolean,
	generation: number,
	sourceIndex: number,
	productionId: string | undefined,
): readonly ModuleSymbol[] {
	if (!trace) return successor;
	const values = new Array<ModuleSymbol>();
	for (const value of successor) {
		const symbolTrace =
			productionId === undefined ? { generation, sourceIndex } : { generation, sourceIndex, productionId };
		values.push({ ...value, trace: symbolTrace });
	}
	return values;
}

/** Performs bounded parallel derivation with deterministic stochastic choices. @public */
export function derive(grammar: CompiledGrammar, options: DerivationOptions): DerivationResult {
	const diagnostics = new Diagnostics();
	const limits = mergeLimits(options.limits);
	const iterations = math.max(0, math.floor(options.iterations));
	const random = options.random ?? new XorShift32(options.seed ?? 1);
	const cancellation = options.cancellation ?? NEVER_CANCELLED;
	const budget = new WorkBudget(limits.maxWorkUnits);
	const globals = options.globalParameters ?? {};
	let current: readonly ModuleSymbol[] = grammar.spec.axiom;
	const history = new Array<readonly ModuleSymbol[]>();
	let completed = 0;
	let truncated = false;
	if (options.includeHistory === true) history.push(current);
	options.observer?.onDerivationStarted?.(current);
	if (iterations > limits.maxIterations) {
		diagnostics.warn("LIMIT_ITERATIONS", `Requested ${iterations} iterations; limited to ${limits.maxIterations}.`);
	}
	const targetIterations = math.min(iterations, limits.maxIterations);
	for (let generation = 0; generation < targetIterations; generation++) {
		if (cancellation.isCancellationRequested()) {
			diagnostics.warn("CANCELLED", "Derivation cancelled before the next generation.");
			options.observer?.onGenerationCancelled?.();
			truncated = true;
			break;
		}
		const nextWord = new SymbolWord();
		for (let index = 0; index < current.size(); index++) {
			const source = current[index];
			if (source === undefined) continue;
			if (!budget.tryConsume()) {
				diagnostics.warn("LIMIT_WORK", "Derivation reached its work-unit limit.", { symbolIndex: index });
				truncated = true;
				break;
			}
			const production = chooseProduction(grammar, current, index, generation, globals, random);
			const context: ProductionContext = {
				symbol: source,
				index,
				generation,
				word: current,
				globalParameters: globals,
				random,
			};
			const rawSuccessor =
				production === undefined
					? [source]
					: typeIs(production.spec.successor, "function")
						? production.spec.successor(context)
						: production.spec.successor;
			const successor = withTrace(
				rawSuccessor,
				options.trace === true,
				generation + 1,
				index,
				production?.spec.id,
			);
			if (nextWord.size() + successor.size() > limits.maxSymbols) {
				const remaining = limits.maxSymbols - nextWord.size();
				const partial = new Array<ModuleSymbol>();
				for (let successorIndex = 0; successorIndex < remaining; successorIndex++) {
					const value = successor[successorIndex];
					if (value !== undefined) partial.push(value);
				}
				nextWord.appendChunk(partial);
				diagnostics.warn("LIMIT_SYMBOLS", "Derivation reached its symbol limit.", { symbolIndex: index });
				truncated = true;
				break;
			}
			nextWord.appendChunk(successor);
			options.observer?.onSymbolRewritten?.(source, successor, production?.spec.id);
		}
		current = nextWord.toArray();
		completed++;
		if (options.includeHistory === true) history.push(current);
		options.observer?.onGenerationStep?.(completed, current.size(), budget.used());
		if (truncated) break;
	}
	const statistics: DerivationStatistics = {
		iterationsCompleted: completed,
		symbols: current.size(),
		workUnits: budget.used(),
		truncated,
		symbolCounts: countSymbols(current),
	};
	const base = {
		word: current,
		diagnostics: diagnostics.all(),
		statistics,
		randomState: random.getState(),
	};
	const result: DerivationResult = options.includeHistory === true ? { ...base, history } : base;
	options.observer?.onDerivationCompleted?.(result);
	return result;
}

/** Static symbol-incidence summary for analyzable fixed successors. @public */
export interface GrammarAnalysis {
	readonly alphabetSize: number;
	readonly productionCount: number;
	readonly fixedSuccessorCounts: Readonly<Record<string, Readonly<Record<string, number>>>>;
	readonly hasDynamicProductions: boolean;
}

/** Analyzes fixed production successors without executing callbacks. @public */
export function analyzeGrammar(grammar: CompiledGrammar): GrammarAnalysis {
	const counts: Record<string, Readonly<Record<string, number>>> = {};
	let dynamic = false;
	for (const production of grammar.spec.productions) {
		if (typeIs(production.successor, "function")) dynamic = true;
		else counts[production.id] = countSymbols(production.successor);
	}
	return {
		alphabetSize: grammar.spec.alphabet.size(),
		productionCount: grammar.spec.productions.size(),
		fixedSuccessorCounts: counts,
		hasDynamicProductions: dynamic,
	};
}

/** Incremental derivation session whose output agrees with one-shot derivation. @public */
export class IncrementalDerivationSession {
	private readonly diagnostics = new Diagnostics();
	private readonly limits: GenerationLimits;
	private readonly random: RandomSource;
	private readonly cancellation: CancellationToken;
	private readonly globals: Readonly<Record<string, SymbolParameter>>;
	private readonly targetIterations: number;
	private current: readonly ModuleSymbol[];
	private output = new SymbolWord();
	private cursor = 0;
	private generation = 0;
	private workUnits = 0;
	private complete = false;
	private truncated = false;
	private readonly history = new Array<readonly ModuleSymbol[]>();

	public constructor(
		private readonly grammar: CompiledGrammar,
		private readonly options: DerivationOptions,
	) {
		this.limits = mergeLimits(options.limits);
		this.random = options.random ?? new XorShift32(options.seed ?? 1);
		this.cancellation = options.cancellation ?? NEVER_CANCELLED;
		this.globals = options.globalParameters ?? {};
		this.current = grammar.spec.axiom;
		this.targetIterations = math.min(math.max(0, math.floor(options.iterations)), this.limits.maxIterations);
		if (options.iterations > this.limits.maxIterations) {
			this.diagnostics.warn(
				"LIMIT_ITERATIONS",
				`Requested ${options.iterations} iterations; limited to ${this.limits.maxIterations}.`,
			);
		}
		if (options.includeHistory === true) this.history.push(this.current);
		options.observer?.onDerivationStarted?.(this.current);
		if (this.targetIterations === 0) this.complete = true;
	}

	/** Advances by at most `maximumWorkUnits` rewritten source symbols. @public */
	public step(maximumWorkUnits: number): number {
		if (this.complete) return 0;
		let used = 0;
		const stepLimit = math.max(0, math.floor(maximumWorkUnits));
		while (used < stepLimit && !this.complete) {
			if (this.cancellation.isCancellationRequested()) {
				this.diagnostics.warn("CANCELLED", "Incremental derivation cancelled.");
				this.options.observer?.onGenerationCancelled?.();
				this.truncated = true;
				this.complete = true;
				break;
			}
			if (this.workUnits >= this.limits.maxWorkUnits) {
				this.diagnostics.warn("LIMIT_WORK", "Incremental derivation reached its work-unit limit.");
				if (this.cursor > 0) {
					this.current = this.output.toArray();
					this.generation++;
				}
				this.truncated = true;
				this.complete = true;
				break;
			}
			const source = this.current[this.cursor];
			if (source !== undefined) {
				const production = chooseProduction(
					this.grammar,
					this.current,
					this.cursor,
					this.generation,
					this.globals,
					this.random,
				);
				const context: ProductionContext = {
					symbol: source,
					index: this.cursor,
					generation: this.generation,
					word: this.current,
					globalParameters: this.globals,
					random: this.random,
				};
				const rawSuccessor =
					production === undefined
						? [source]
						: typeIs(production.spec.successor, "function")
							? production.spec.successor(context)
							: production.spec.successor;
				const successor = withTrace(
					rawSuccessor,
					this.options.trace === true,
					this.generation + 1,
					this.cursor,
					production?.spec.id,
				);
				if (this.output.size() + successor.size() > this.limits.maxSymbols) {
					const remaining = this.limits.maxSymbols - this.output.size();
					const partial = new Array<ModuleSymbol>();
					for (let index = 0; index < remaining; index++) {
						const value = successor[index];
						if (value !== undefined) partial.push(value);
					}
					this.output.appendChunk(partial);
					this.diagnostics.warn("LIMIT_SYMBOLS", "Incremental derivation reached its symbol limit.");
					this.current = this.output.toArray();
					this.generation++;
					this.truncated = true;
					this.complete = true;
					break;
				}
				this.output.appendChunk(successor);
				this.options.observer?.onSymbolRewritten?.(source, successor, production?.spec.id);
			}
			this.cursor++;
			this.workUnits++;
			used++;
			if (this.cursor >= this.current.size()) {
				this.current = this.output.toArray();
				this.output = new SymbolWord();
				this.cursor = 0;
				this.generation++;
				if (this.options.includeHistory === true) this.history.push(this.current);
				this.options.observer?.onGenerationStep?.(this.generation, this.current.size(), this.workUnits);
				if (this.generation >= this.targetIterations) this.complete = true;
			}
		}
		return used;
	}

	/** Reports whether the requested iterations ended or a bound stopped work. */
	public isComplete(): boolean {
		return this.complete;
	}

	/** Returns the final or bounded-partial result after completion. */
	public getResult(): DerivationResult | undefined {
		if (!this.complete) return undefined;
		const statistics: DerivationStatistics = {
			iterationsCompleted: this.generation,
			symbols: this.current.size(),
			workUnits: this.workUnits,
			truncated: this.truncated,
			symbolCounts: countSymbols(this.current),
		};
		const base = {
			word: this.current,
			diagnostics: this.diagnostics.all(),
			statistics,
			randomState: this.random.getState(),
		};
		return this.options.includeHistory === true ? { ...base, history: this.history } : base;
	}
}
