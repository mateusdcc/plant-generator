import { describe, expect, it } from "vitest";
import {
	BehaviorRegistry,
	DistanceLodPolicy,
	EditableMeshPlantRenderer,
	InstancePool,
	LruGenerationCache,
	MODEL_SCHEMA_VERSION,
	PLANT_PRESETS,
	PlantCompiler,
	PlantGenerator,
	PlantSerializer,
	PresetRegistry,
	compileModelSpecification,
	createBehaviorRegistries,
	emptyMesh,
	extendModelSpecification,
	hashBranchGraph,
	hashModelSpecification,
	migrateModelSpecification,
	populateEditableMesh,
	symbol,
	vec3,
	type EditableMeshCapability,
	type InstancePoolPolicy,
	type ModelSpecification,
	type PlantGenerationResult,
} from "../src";

const GALLERY_PRESET_IDS = [
	"flowering-stem",
	"branching-herb",
	"bush",
	"conifer",
	"broad-canopy-tree",
	"vine",
] as const;

function generateGalleryPreset(id: (typeof GALLERY_PRESET_IDS)[number], iterations = 4): PlantGenerationResult {
	return PlantGenerator.generate(PlantCompiler.compile(PLANT_PRESETS[id]!), {
		seed: 2026,
		iterations,
		limits: { maxSymbols: 50_000, maxSegments: 5_000, maxOrgans: 5_000, maxWorkUnits: 400_000 },
	});
}

function topologyMetrics(result: PlantGenerationResult) {
	const { bounds, segments } = result.branchGraph;
	let leaderSegments = 0;
	let rootSegments = 0;
	let maximumOrder = 0;
	let minimumLateralHeight = Number.POSITIVE_INFINITY;
	for (const segment of segments) {
		if (segment.branchOrder === 0) leaderSegments++;
		if (segment.parentSegmentId === undefined) rootSegments++;
		maximumOrder = Math.max(maximumOrder, segment.branchOrder);
		if (segment.branchOrder > 0) minimumLateralHeight = Math.min(minimumLateralHeight, segment.start.y);
	}
	const spanX = bounds.max.x - bounds.min.x;
	const spanZ = bounds.max.z - bounds.min.z;
	return {
		segments: segments.length,
		axes: result.branchGraph.axes.length,
		leaderSegments,
		rootSegments,
		maximumOrder,
		height: Number((bounds.max.y - bounds.min.y).toFixed(3)),
		horizontalSpan: Number(Math.hypot(spanX, spanZ).toFixed(3)),
		minimumLateralHeight: Number(minimumLateralHeight.toFixed(3)),
	};
}

describe("high-level runtime", () => {
	it("keeps built-in recursive preset branches balanced", () => {
		for (const id of GALLERY_PRESET_IDS) {
			const result = generateGalleryPreset(id, 5);
			const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
			expect(codes, id).not.toContain("UNBALANCED_BRANCH");
			expect(
				codes.filter((code) => code.startsWith("LIMIT_")),
				id,
			).toHaveLength(0);
			expect(result.statistics.truncated, id).toBe(false);
			expect(result.statistics.symbols, id).toBeLessThan(50_000);
			expect(result.statistics.segments, id).toBeGreaterThan(0);
			expect(result.statistics.segments, id).toBeLessThan(5_000);
			expect(result.statistics.workUnits, id).toBeLessThan(400_000);
		}
	});

	it("gives gallery presets architecture-specific topology and silhouettes", () => {
		const results: Record<string, PlantGenerationResult> = {};
		const metrics: Record<string, ReturnType<typeof topologyMetrics>> = {};
		for (const id of GALLERY_PRESET_IDS) {
			const result = generateGalleryPreset(id);
			results[id] = result;
			metrics[id] = topologyMetrics(result);
		}

		const floweringStem = metrics["flowering-stem"]!;
		const branchingHerb = metrics["branching-herb"]!;
		const bush = metrics.bush!;
		const conifer = metrics.conifer!;
		const broadCanopyTree = metrics["broad-canopy-tree"]!;
		const vine = metrics.vine!;

		expect(floweringStem.maximumOrder).toBe(1);
		expect(floweringStem.leaderSegments).toBeGreaterThan(1);
		expect(floweringStem.height).toBeGreaterThan(floweringStem.horizontalSpan * 2);

		expect(branchingHerb.leaderSegments).toBe(1);
		expect(branchingHerb.maximumOrder).toBeGreaterThanOrEqual(4);
		expect(branchingHerb.segments).toBeGreaterThan(floweringStem.segments * 2);

		expect(bush.rootSegments).toBe(6);
		expect(bush.leaderSegments).toBe(0);
		expect(bush.horizontalSpan).toBeGreaterThan(bush.height * 2.5);
		expect(bush.segments).toBeGreaterThan(branchingHerb.segments * 4);

		expect(conifer.leaderSegments).toBeGreaterThanOrEqual(4);
		expect(conifer.maximumOrder).toBe(2);
		expect(conifer.height).toBeGreaterThan(conifer.horizontalSpan);

		expect(broadCanopyTree.rootSegments).toBe(1);
		expect(broadCanopyTree.minimumLateralHeight).toBeGreaterThan(3);
		expect(broadCanopyTree.horizontalSpan).toBeGreaterThan(conifer.horizontalSpan);

		expect(vine.maximumOrder).toBe(1);
		expect(vine.leaderSegments).toBeGreaterThanOrEqual(8);
		expect(vine.height).toBeGreaterThan(vine.horizontalSpan * 2);
		expect(vine.horizontalSpan).toBeGreaterThan(floweringStem.horizontalSpan);

		const floweringKinds = new Set(results["flowering-stem"]!.organs.map((organ) => organ.kind));
		const herbKinds = new Set(results["branching-herb"]!.organs.map((organ) => organ.kind));
		expect(floweringKinds).toEqual(new Set(["leaf", "flower"]));
		expect(herbKinds).toEqual(new Set(["leaf", "flower"]));
		for (const id of ["bush", "conifer", "broad-canopy-tree", "vine"] as const) {
			const organs = results[id]!.organs;
			expect(organs.length, id).toBeGreaterThan(0);
			expect(new Set(organs.map((organ) => organ.kind)), id).toEqual(new Set(["leaf"]));
		}

		const structuralSignatures = new Set(
			GALLERY_PRESET_IDS.map((id) => {
				const metric = metrics[id]!;
				return `${metric.segments}:${metric.leaderSegments}:${metric.rootSegments}:${metric.maximumOrder}`;
			}),
		);
		expect(structuralSignatures.size).toBe(GALLERY_PRESET_IDS.length);
	});

	it("generates identical topology, cache output, and incremental output", () => {
		const model = PlantCompiler.compile(PLANT_PRESETS["branching-herb"]!);
		const options = { seed: 12345, iterations: 4, limits: { maxSymbols: 20_000, maxSegments: 5_000 } };
		const first = PlantGenerator.generate(model, options);
		const second = PlantGenerator.generate(model, options);
		expect(hashBranchGraph(first.branchGraph)).toBe(hashBranchGraph(second.branchGraph));
		const session = PlantGenerator.createSession(model, options);
		while (!session.isComplete()) session.step(17);
		expect(hashBranchGraph(session.getResult()!.branchGraph)).toBe(hashBranchGraph(first.branchGraph));

		const cache = new LruGenerationCache<typeof first>(2);
		PlantGenerator.generate(model, { ...options, cache });
		expect(PlantGenerator.generate(model, { ...options, cache }).statistics.cacheHit).toBe(true);
	});

	it("hashes every declarative model group that can affect generated output", () => {
		const base = PLANT_PRESETS.conifer!;
		const baseHash = hashModelSpecification(base);
		const firstProduction = base.grammar.productions[0]!;
		const variants: readonly ModelSpecification[] = [
			{ ...base, version: "0.1.1" },
			{
				...base,
				grammar: {
					...base.grammar,
					productions: [{ ...firstProduction, priority: 7 }, ...base.grammar.productions.slice(1)],
				},
			},
			extendModelSpecification(base, { turtle: { initialWidth: 2 } }),
			extendModelSpecification(base, { geometry: { radialResolution: 3 } }),
			extendModelSpecification(base, { organs: { terminalLeafKind: "needle" } }),
			extendModelSpecification(base, { animation: { duration: 24 } }),
			extendModelSpecification(base, { lod: { fullDistance: 12 } }),
			extendModelSpecification(base, { extensions: { architectureRevision: 2 } }),
		];

		for (const variant of variants) expect(hashModelSpecification(variant)).not.toBe(baseHash);
	});

	it("keeps inline production callbacks isolated in a shared cache", () => {
		const createDynamicSpecification = (length: number): ModelSpecification => ({
			schemaVersion: 1,
			id: "runtime-callback-cache",
			version: "1.0.0",
			grammar: {
				alphabet: [{ id: "A" }, { id: "F", parameterTypes: ["number"] }],
				axiom: [symbol("A")],
				productions: [{ id: "grow", predecessor: "A", successor: () => [symbol("F", length)] }],
			},
		});
		const shortModel = PlantCompiler.compile(createDynamicSpecification(1));
		const tallModel = PlantCompiler.compile(createDynamicSpecification(3));
		expect(shortModel.hash).toBe(tallModel.hash);

		const cache = new LruGenerationCache<PlantGenerationResult>(4);
		const short = PlantGenerator.generate(shortModel, { seed: 1, iterations: 1, cache });
		const tall = PlantGenerator.generate(tallModel, { seed: 1, iterations: 1, cache });
		expect(short.branchGraph.segments[0]?.end.y).toBe(1);
		expect(tall.branchGraph.segments[0]?.end.y).toBe(3);
		expect(tall.statistics.cacheHit).toBe(false);
		expect(PlantGenerator.generate(tallModel, { seed: 1, iterations: 1, cache }).statistics.cacheHit).toBe(true);
	});

	it("includes effective generation limits in cache identity", () => {
		const specification: ModelSpecification = {
			schemaVersion: 1,
			id: "limit-aware-cache",
			grammar: {
				alphabet: [{ id: "A" }, { id: "F" }],
				axiom: [symbol("A")],
				productions: [{ id: "grow", predecessor: "A", successor: [symbol("F"), symbol("F"), symbol("F")] }],
			},
		};
		const model = PlantCompiler.compile(specification);
		const cache = new LruGenerationCache<PlantGenerationResult>(4);
		const full = PlantGenerator.generate(model, { seed: 1, iterations: 1, limits: { maxSegments: 10 }, cache });
		const limited = PlantGenerator.generate(model, {
			seed: 1,
			iterations: 1,
			limits: { maxSegments: 1 },
			cache,
		});

		expect(full.branchGraph.segments).toHaveLength(3);
		expect(limited.branchGraph.segments).toHaveLength(1);
		expect(limited.statistics.cacheHit).toBe(false);
		expect(
			PlantGenerator.generate(model, {
				seed: 1,
				iterations: 1,
				limits: { maxSegments: 1 },
				cache,
			}).statistics.cacheHit,
		).toBe(true);
	});

	it("does not cache results produced under an external cancellation token", () => {
		const specification: ModelSpecification = {
			schemaVersion: 1,
			id: "cancelled-cache-bypass",
			grammar: {
				alphabet: [{ id: "A" }, { id: "F" }],
				axiom: [symbol("A")],
				productions: [{ id: "grow", predecessor: "A", successor: [symbol("F"), symbol("F")] }],
			},
		};
		const model = PlantCompiler.compile(specification);
		const cache = new LruGenerationCache<PlantGenerationResult>(2);
		const cancelled = PlantGenerator.generate(model, {
			seed: 1,
			iterations: 1,
			cache,
			cancellation: { isCancellationRequested: () => true },
		});
		const complete = PlantGenerator.generate(model, { seed: 1, iterations: 1, cache });

		expect(cancelled.diagnostics.map((diagnostic) => diagnostic.code)).toContain("CANCELLED");
		expect(complete.branchGraph.segments).toHaveLength(2);
		expect(complete.statistics.cacheHit).toBe(false);
		expect(PlantGenerator.generate(model, { seed: 1, iterations: 1, cache }).statistics.cacheHit).toBe(true);
	});

	it("serializes descriptors and enforces allow-lists", () => {
		const model = PlantCompiler.compile(PLANT_PRESETS.conifer!);
		const generated = PlantGenerator.generate(model, { seed: 8, iterations: 2 });
		const envelope = PlantSerializer.serialize(generated.descriptor);
		expect(PlantSerializer.deserialize(envelope, ["conifer"]).value).toEqual(generated.descriptor);
		expect(PlantSerializer.deserialize(envelope, ["other"]).diagnostics[0]?.code).toBe("INVALID_PARAMETER");
	});

	it("migrates specs and extends presets immutably", () => {
		const base = PLANT_PRESETS.bush!;
		const extended = extendModelSpecification(base, { id: "small-bush", turtle: { stepSize: 0.25 } });
		expect(extended.turtle?.stepSize).toBe(0.25);
		expect(base.turtle?.stepSize).not.toBe(0.25);
		const legacy = { ...base, schemaVersion: undefined };
		expect(migrateModelSpecification(legacy as never).schemaVersion).toBe(MODEL_SCHEMA_VERSION);
		const presets = new PresetRegistry();
		expect(presets.extend("bush", "child", { metadata: { name: "Child" } }).id).toBe("child");
	});

	it("resolves named production operations and rejects unknown ids", () => {
		const registries = createBehaviorRegistries();
		registries.productionOperations.register("double", () => [symbol("F"), symbol("F")]);
		const spec: ModelSpecification = {
			schemaVersion: 1,
			id: "registered",
			grammar: {
				alphabet: [{ id: "F" }],
				axiom: [symbol("F")],
				productions: [{ id: "grow", predecessor: "F", successor: [], operationId: "double" }],
			},
		};
		expect(compileModelSpecification(spec, registries).model).toBeDefined();
		expect(
			compileModelSpecification(
				{
					...spec,
					grammar: {
						...spec.grammar,
						productions: [{ ...spec.grammar.productions[0]!, operationId: "missing" }],
					},
				},
				registries,
			).diagnostics[0]?.code,
		).toBe("UNKNOWN_REGISTRY_ID");
	});

	it("handles registry, cache, and LOD policies", () => {
		const registry = new BehaviorRegistry<number>();
		registry.register("value", 7);
		expect(registry.resolve("value")).toBe(7);
		const cache = new LruGenerationCache<number>(1);
		cache.set("a", 1);
		cache.set("b", 2);
		expect(cache.get("a")).toBeUndefined();
		const model = PlantCompiler.compile(PLANT_PRESETS.vine!);
		const generated = PlantGenerator.generate(model, { seed: 1, iterations: 1 });
		expect(new DistanceLodPolicy().select(400, generated).level).toBe("impostor");
	});

	it("publishes structured diagnostics through the high-level observer", () => {
		const codes = new Array<string>();
		PlantGenerator.generate(PlantCompiler.compile(PLANT_PRESETS.vine!), {
			seed: 3,
			iterations: 20,
			limits: { maxIterations: 1 },
			observer: { onDiagnosticEmitted: (diagnostic) => codes.push(diagnostic.code) },
		});
		expect(codes).toContain("LIMIT_ITERATIONS");
	});
});

describe("adapter failures", () => {
	it("reports pool exhaustion without leaking capacity", () => {
		const policy: InstancePoolPolicy<Instance> = {
			create() {
				return { Destroy() {} } as unknown as Instance;
			},
			reset() {},
		};
		const pool = new InstancePool(1, policy);
		expect(pool.acquire()).toBeDefined();
		expect(pool.acquire()).toBeUndefined();
		expect(pool.statistics().exhausted).toBe(1);
	});

	it("fails gracefully when EditableMesh is unsupported", () => {
		const capability: EditableMeshCapability = {
			isAvailable() {
				return false;
			},
			createEditableMesh() {
				return undefined;
			},
			createMeshPart() {
				return undefined;
			},
		};
		const renderer = new EditableMeshPlantRenderer(capability, {} as Instance);
		const model = PlantCompiler.compile(PLANT_PRESETS.vine!);
		const generated = PlantGenerator.generate(model, { seed: 1, iterations: 1 });
		expect(() => renderer.render(generated)).toThrow(/unavailable/);
	});

	it("rejects EditableMesh conversion before exceeding configured limits", () => {
		const mesh = { ...emptyMesh(), vertices: [vec3(0, 0, 0)] };
		expect(() => populateEditableMesh(mesh, {} as EditableMesh, { maxVertices: 0, maxTriangles: 0 })).toThrow(
			/vertex limit/,
		);
	});
});

describe("specification failures", () => {
	it("rejects unsupported schema and corrupt descriptors", () => {
		const spec = { ...PLANT_PRESETS.vine!, schemaVersion: 99 };
		expect(compileModelSpecification(spec).diagnostics[0]?.code).toBe("UNSUPPORTED_SCHEMA_VERSION");
		const corrupt = { kind: "plant-descriptor", version: 1, value: { schemaVersion: 2 } };
		expect(PlantSerializer.deserialize(corrupt as never).diagnostics[0]?.code).toBe("UNSUPPORTED_SCHEMA_VERSION");
	});
});
