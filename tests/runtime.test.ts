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
	migrateModelSpecification,
	populateEditableMesh,
	symbol,
	vec3,
	type EditableMeshCapability,
	type InstancePoolPolicy,
	type ModelSpecification,
} from "../src";

describe("high-level runtime", () => {
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
