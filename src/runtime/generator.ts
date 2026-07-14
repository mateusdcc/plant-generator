import { type Diagnostic } from "../core/diagnostics";
import { IncrementalDerivationSession, derive, type DerivationResult, type GenerationObserver } from "../core/grammar";
import type { StructuredParameter, SymbolParameter } from "../core/symbols";
import { emptyMesh, validateMesh, type MeshData } from "../geometry/mesh";
import { createBranchMesh } from "../geometry/tubes";
import { vec3, type Transform3 } from "../math/vector";
import {
	findTerminalSegments,
	validateBranchGraph,
	type BranchGraph,
	type BranchSegment,
} from "../topology/branch-graph";
import { interpret3D } from "../turtle/interpreter";
import type { GenerationCache } from "./cache";
import { CancellationSource, type CancellationToken, type GenerationLimits } from "./limits";
import type { PlantDescriptor } from "./serialization";
import {
	compileModelSpecification,
	hashSymbolParameters,
	type CompiledPlantModel,
	type ModelSpecification,
	type PlantCompileResult,
} from "./specification";
import type { BehaviorRegistries } from "./registry";

/** Generated organ socket independent of visual representation. @public */
export interface GeneratedOrgan {
	readonly id: number;
	readonly kind: string;
	readonly segmentId: number;
	readonly transform: Transform3;
	readonly birthTime: number;
	readonly metadata: StructuredParameter;
}

/** Aggregate counters returned by high-level generation. @public */
export interface PlantGenerationStatistics {
	readonly symbols: number;
	readonly iterations: number;
	readonly segments: number;
	readonly organs: number;
	readonly vertices: number;
	readonly triangles: number;
	readonly workUnits: number;
	readonly truncated: boolean;
	readonly cacheHit: boolean;
}

/** Renderer-independent high-level generation output. @public */
export interface PlantGenerationResult {
	readonly descriptor: PlantDescriptor;
	readonly branchGraph: BranchGraph;
	readonly organs: readonly GeneratedOrgan[];
	readonly meshData: MeshData;
	readonly diagnostics: readonly Diagnostic[];
	readonly statistics: PlantGenerationStatistics;
}

/** High-level optional lifecycle observer. @public */
export interface PlantGenerationObserver extends GenerationObserver {
	/** Called as each renderer-neutral branch segment is emitted. */
	onBranchEmitted?(segment: BranchSegment): void;
	/** Called as each generated organ socket is emitted. */
	onOrganEmitted?(organ: GeneratedOrgan): void;
	/** Called at coarse topology and geometry phase boundaries. */
	onTopologyEvent?(event: "interpreted" | "geometry-complete"): void;
	/** Called for every diagnostic included in the generation result. */
	onDiagnosticEmitted?(diagnostic: Diagnostic): void;
}

/** High-level deterministic generation options. @public */
export interface PlantGenerationOptions {
	readonly seed: number;
	readonly iterations: number;
	readonly parameters?: Readonly<Record<string, SymbolParameter>>;
	readonly mutations?: StructuredParameter;
	readonly time?: number;
	readonly limits?: Partial<GenerationLimits>;
	readonly cancellation?: CancellationToken;
	readonly observer?: PlantGenerationObserver;
	readonly cache?: GenerationCache<PlantGenerationResult>;
}

/** Compiler facade for versioned reusable models. @public */
export class PlantCompiler {
	/** Compiles a specification and preserves every validation diagnostic. */
	public static compileWithDiagnostics(
		specification: ModelSpecification,
		registries?: BehaviorRegistries,
	): PlantCompileResult {
		return compileModelSpecification(specification, registries);
	}

	/**
	 * Compiles a model or throws if validation fails.
	 *
	 * @throws When the model schema, grammar, or registry references are invalid.
	 * @public
	 */
	public static compile(specification: ModelSpecification, registries?: BehaviorRegistries): CompiledPlantModel {
		const result = compileModelSpecification(specification, registries);
		assert(result.model !== undefined, result.diagnostics[0]?.message ?? "Plant model compilation failed.");
		return result.model;
	}
}

function cacheKey(model: CompiledPlantModel, options: PlantGenerationOptions): string {
	return `${model.hash}:${options.seed}:${options.iterations}:${options.time ?? 0}:${hashSymbolParameters(options.parameters ?? {})}:${hashSymbolParameters(options.mutations ?? {})}`;
}

function createOrgans(
	model: CompiledPlantModel,
	graph: BranchGraph,
	observer: PlantGenerationObserver | undefined,
): readonly GeneratedOrgan[] {
	const organs = new Array<GeneratedOrgan>();
	const terminals = findTerminalSegments(graph);
	for (let index = 0; index < terminals.size(); index++) {
		const segment = terminals[index];
		if (segment === undefined) continue;
		const leafKind = model.specification.organs?.terminalLeafKind;
		const flowerKind = model.specification.organs?.terminalFlowerKind;
		const kind =
			flowerKind !== undefined &&
			index % math.max(1, math.floor(1 / math.max(model.specification.organs?.flowerDensity ?? 1, 1e-6))) === 0
				? flowerKind
				: leafKind;
		if (kind === undefined) continue;
		const organ: GeneratedOrgan = {
			id: organs.size(),
			kind,
			segmentId: segment.id,
			transform: { position: segment.end, frame: segment.frame, scale: vec3(1, 1, 1) },
			birthTime: segment.birthTime,
			metadata: {},
		};
		organs.push(organ);
		observer?.onOrganEmitted?.(organ);
	}
	return organs;
}

function assembleResult(
	model: CompiledPlantModel,
	options: PlantGenerationOptions,
	derivation: DerivationResult,
	cacheHit: boolean,
): PlantGenerationResult {
	const turtle = interpret3D(derivation.word, {
		...model.specification.turtle,
		...(options.limits === undefined ? {} : { limits: options.limits }),
		sink: {
			onSegment(segment): void {
				options.observer?.onBranchEmitted?.(segment);
			},
		},
	});
	options.observer?.onTopologyEvent?.("interpreted");
	const graph = turtle.branchGraph;
	const organs = createOrgans(model, graph, options.observer);
	let mesh = emptyMesh();
	if (model.specification.geometry?.enabled !== false) {
		const factoryId = model.specification.geometry?.factoryId;
		const factory = factoryId === undefined ? undefined : model.registries?.geometryFactories.resolve(factoryId);
		mesh =
			factory?.create(graph) ??
			createBranchMesh(graph, {
				radialResolution: model.specification.geometry?.radialResolution ?? 8,
				junctionMode: model.specification.geometry?.junctionMode ?? "overlap",
				capStart: model.specification.geometry?.capBranches ?? true,
				capEnd: model.specification.geometry?.capBranches ?? true,
			});
	}
	options.observer?.onTopologyEvent?.("geometry-complete");
	const diagnostics = new Array<Diagnostic>();
	for (const value of derivation.diagnostics) diagnostics.push(value);
	for (const value of turtle.diagnostics) diagnostics.push(value);
	for (const value of validateBranchGraph(graph)) diagnostics.push(value);
	for (const value of validateMesh(mesh)) diagnostics.push(value);
	for (const diagnostic of diagnostics) options.observer?.onDiagnosticEmitted?.(diagnostic);
	const descriptor: PlantDescriptor = {
		schemaVersion: 1,
		modelId: model.specification.id,
		...(model.specification.version === undefined ? {} : { modelVersion: model.specification.version }),
		modelHash: model.hash,
		seed: options.seed,
		iterations: options.iterations,
		time: options.time ?? 0,
		parameterOverrides: options.parameters ?? {},
		mutations: options.mutations ?? {},
	};
	return {
		descriptor,
		branchGraph: graph,
		organs,
		meshData: mesh,
		diagnostics,
		statistics: {
			symbols: derivation.statistics.symbols,
			iterations: derivation.statistics.iterationsCompleted,
			segments: graph.segments.size(),
			organs: organs.size(),
			vertices: mesh.vertices.size(),
			triangles: mesh.triangleIndices.size() / 3,
			workUnits: derivation.statistics.workUnits + derivation.statistics.symbols + graph.segments.size(),
			truncated: derivation.statistics.truncated,
			cacheHit,
		},
	};
}

/** Incremental high-level session. Derivation is processed symbol-by-symbol. @public */
export class PlantGenerationSession {
	private readonly derivation: IncrementalDerivationSession;
	private readonly cancellationSource = new CancellationSource();
	private result?: PlantGenerationResult;

	public constructor(
		private readonly model: CompiledPlantModel,
		private readonly options: PlantGenerationOptions,
	) {
		const cancellation = new CombinedCancellationToken(this.cancellationSource, options.cancellation);
		this.derivation = new IncrementalDerivationSession(model.grammar, {
			iterations: options.iterations,
			seed: options.seed,
			...(options.limits === undefined ? {} : { limits: options.limits }),
			...(options.parameters === undefined ? {} : { globalParameters: options.parameters }),
			cancellation,
			...(options.observer === undefined ? {} : { observer: options.observer }),
		});
	}

	/** Advances the reusable derivation buffers by a bounded work amount. @public */
	public step(maximumWorkUnits: number): number {
		if (this.result !== undefined) return 0;
		const used = this.derivation.step(maximumWorkUnits);
		if (this.derivation.isComplete()) {
			const derivationResult = this.derivation.getResult();
			if (derivationResult !== undefined)
				this.result = assembleResult(this.model, this.options, derivationResult, false);
		}
		return used;
	}

	/** Reports whether generation has produced a final or bounded-partial result. */
	public isComplete(): boolean {
		return this.result !== undefined;
	}

	/** Returns the result after completion, otherwise `undefined`. */
	public getResult(): PlantGenerationResult | undefined {
		return this.result;
	}

	/** Requests cooperative cancellation at the next derivation boundary. */
	public cancel(): void {
		this.cancellationSource.cancel();
	}
}

class CombinedCancellationToken implements CancellationToken {
	public constructor(
		private readonly internal: CancellationToken,
		private readonly external?: CancellationToken,
	) {}

	public isCancellationRequested(): boolean {
		return this.internal.isCancellationRequested() || this.external?.isCancellationRequested() === true;
	}
}

/** Convenient synchronous and incremental generation facade. @public */
export class PlantGenerator {
	/** Generates a deterministic plant synchronously, consulting an optional cache. */
	public static generate(model: CompiledPlantModel, options: PlantGenerationOptions): PlantGenerationResult {
		const key = cacheKey(model, options);
		const cached = options.cache?.get(key);
		if (cached !== undefined) {
			for (const diagnostic of cached.diagnostics) options.observer?.onDiagnosticEmitted?.(diagnostic);
			return { ...cached, statistics: { ...cached.statistics, cacheHit: true } };
		}
		const derivation = derive(model.grammar, {
			iterations: options.iterations,
			seed: options.seed,
			...(options.limits === undefined ? {} : { limits: options.limits }),
			...(options.parameters === undefined ? {} : { globalParameters: options.parameters }),
			...(options.cancellation === undefined ? {} : { cancellation: options.cancellation }),
			...(options.observer === undefined ? {} : { observer: options.observer }),
		});
		const result = assembleResult(model, options, derivation, false);
		options.cache?.set(key, result);
		return result;
	}

	/** Creates a deterministic incremental generation session. */
	public static createSession(model: CompiledPlantModel, options: PlantGenerationOptions): PlantGenerationSession {
		return new PlantGenerationSession(model, options);
	}
}
