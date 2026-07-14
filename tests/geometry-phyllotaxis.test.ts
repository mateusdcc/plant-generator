import { describe, expect, it } from "vitest";
import {
	GOLDEN_ANGLE,
	analyzeParastichies,
	createBlade,
	createBranchMesh,
	createDisk,
	createPetal,
	createRibbon,
	createTreeGraph,
	createTubeMesh,
	placeCylindricalPhyllotaxis,
	placePlanarPhyllotaxis,
	validateMesh,
	vec3,
} from "../src";

function expectValid(mesh: ReturnType<typeof createDisk>) {
	expect(validateMesh(mesh)).toHaveLength(0);
	for (const index of mesh.triangleIndices) expect(index).toBeLessThan(mesh.vertices.length);
	for (const vertex of mesh.vertices) {
		expect(vertex.x).toBeGreaterThanOrEqual(mesh.bounds.min.x - 1e-9);
		expect(vertex.x).toBeLessThanOrEqual(mesh.bounds.max.x + 1e-9);
	}
}

describe("mesh generation", () => {
	it("builds valid tubes, branches, blades, petals, ribbons, and disks", () => {
		expectValid(
			createTubeMesh([vec3(0, 0, 0), vec3(0, 1, 0), vec3(0.2, 2, 0)], [0.2, 0.15, 0.05], {
				radialResolution: 7,
				capStart: true,
				capEnd: true,
			}),
		);
		expectValid(createBlade(2, 0.6, { curvature: (t) => t * t * 0.2 }));
		expectValid(createPetal());
		expectValid(createRibbon([vec3(0, 0, 0), vec3(0, 1, 0), vec3(0, 2, 0)], [0.2, 0.4, 0.1]));
		expectValid(createDisk(1, 0.5));
		const graph = createTreeGraph({
			maxDepth: 1,
			childrenPerApex: 2,
			initialLength: 1,
			initialRadius: 0.1,
			lengthDecay: 0.7,
			radiusDecay: 0.6,
			inclinationRadians: 0.5,
		});
		expectValid(createBranchMesh(graph, { radialResolution: 5, junctionMode: "collar" }));
	});

	it("rejects invalid triangle indexes", () => {
		const mesh = createDisk();
		const corrupt = { ...mesh, triangleIndices: [999, 0, 1] };
		expect(validateMesh(corrupt)[0]?.code).toBe("INVALID_MESH");
	});
});

describe("phyllotaxis", () => {
	it("is deterministic, finite, incremental, and spacing-aware", () => {
		const options = {
			count: 100,
			divergenceAngle: GOLDEN_ANGLE,
			seed: 99,
			jitter: 0.01,
			organRadius: () => 0.03,
			spacing: { minimumGap: 0.01, radialStep: 0.02, maxAttempts: 20 },
		};
		const first = placePlanarPhyllotaxis(options);
		const second = placePlanarPhyllotaxis(options);
		expect(first).toEqual(second);
		expect(first).toHaveLength(100);
		const tail = placePlanarPhyllotaxis({ ...options, count: 5, startIndex: 100 });
		expect(tail[0]?.index).toBe(100);
		for (const placement of first) expect(Number.isFinite(placement.transform.position.x)).toBe(true);
	});

	it("places cylindrical organs and identifies Fibonacci-like spirals", () => {
		const placements = placeCylindricalPhyllotaxis({
			count: 20,
			cylinderRadius: (index) => 1 - index * 0.02,
			height: (index) => index * 0.1,
		});
		expect(placements[19]?.transform.position.z).toBeCloseTo(1.9);
		const counts = analyzeParastichies(GOLDEN_ANGLE).map((value) => value.count);
		expect(counts.some((value) => value === 8 || value === 13 || value === 21)).toBe(true);
	});
});
