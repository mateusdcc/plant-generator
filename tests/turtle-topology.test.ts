import { describe, expect, it } from "vitest";
import {
	ConstantDirectionalField,
	computeApproximateBiomass,
	computeTotalLength,
	createTreeGraph,
	depthFirstSegments,
	findTerminalSegments,
	hashBranchGraph,
	interpret2D,
	interpret3D,
	pruneBranchGraph,
	querySegments,
	rescaleBranchGraph,
	symbol,
	validateBranchGraph,
	vec3,
} from "../src";

describe("turtle interpretation", () => {
	it("draws a 2D square with parameterized commands", () => {
		const word = [
			symbol("F", 1),
			symbol("+", Math.PI / 2),
			symbol("F", 1),
			symbol("+", Math.PI / 2),
			symbol("F", 1),
			symbol("+", Math.PI / 2),
			symbol("F", 1),
		];
		const result = interpret2D(word);
		expect(result.segments).toHaveLength(4);
		expect(result.segments[3]?.end.x).toBeCloseTo(0, 8);
		expect(result.segments[3]?.end.y).toBeCloseTo(0, 8);
	});

	it("restores pushed state and keeps frames orthonormal", () => {
		const result = interpret3D([
			symbol("F"),
			symbol("["),
			symbol("+", 0.7),
			symbol("^", 0.3),
			symbol("\\", 0.2),
			symbol("F"),
			symbol("]"),
			symbol("F"),
		]);
		expect(result.branchGraph.segments).toHaveLength(3);
		expect(result.branchGraph.segments[2]?.start).toEqual(result.branchGraph.segments[0]?.end);
		for (const segment of result.branchGraph.segments) {
			const { heading, left, up } = segment.frame;
			expect(heading.x * left.x + heading.y * left.y + heading.z * left.z).toBeCloseTo(0, 8);
			expect(heading.x * up.x + heading.y * up.y + heading.z * up.z).toBeCloseTo(0, 8);
		}
	});

	it("applies tropism and enforces segment limits", () => {
		const result = interpret3D([symbol("F"), symbol("F"), symbol("F")], {
			tropism: { field: new ConstantDirectionalField(vec3(1, 0, 0)), strength: 0.5 },
			limits: { maxSegments: 2 },
		});
		expect(result.branchGraph.segments).toHaveLength(2);
		expect(result.diagnostics.map((value) => value.code)).toContain("LIMIT_SEGMENTS");
		expect(result.branchGraph.segments[1]?.end.x).not.toBe(0);
	});

	it("captures polygons and diagnoses stack underflow", () => {
		const result = interpret3D([
			symbol("{"),
			symbol("."),
			symbol("f"),
			symbol("."),
			symbol("+"),
			symbol("f"),
			symbol("."),
			symbol("}"),
			symbol("]"),
		]);
		expect(result.polygons).toHaveLength(1);
		expect(result.diagnostics[0]?.code).toBe("UNBALANCED_BRANCH");
	});

	it("emits botanical attachment sockets at the active turtle frame", () => {
		const emittedKinds = new Array<string>();
		const result = interpret3D(
			[
				symbol("F"),
				symbol("["),
				symbol("+", Math.PI / 2),
				symbol("F"),
				symbol("L"),
				symbol("]"),
				symbol("F"),
				symbol("K"),
			],
			{
				attachmentMappings: [
					{ symbol: "L", kind: "leaf" },
					{ symbol: "K", kind: "flower" },
				],
				sink: { onAttachment: (attachment) => emittedKinds.push(attachment.kind) },
			},
		);
		expect(result.branchGraph.attachments.map((attachment) => attachment.kind)).toEqual(["leaf", "flower"]);
		expect(emittedKinds).toEqual(["leaf", "flower"]);
		expect(result.branchGraph.attachments[0]?.segmentId).toBe(1);
		expect(result.branchGraph.attachments[1]?.segmentId).toBe(2);
		expect(result.branchGraph.attachments[1]?.transform.position).toEqual(result.branchGraph.segments[2]?.end);
	});
});

describe("branch topology", () => {
	it("generates deterministic, valid recursive topology", () => {
		const options = {
			maxDepth: 3,
			childrenPerApex: 2,
			internodesPerAxis: 2,
			initialLength: 2,
			initialRadius: 0.2,
			lengthDecay: 0.7,
			radiusDecay: 0.65,
			inclinationRadians: 0.6,
			seed: 42,
		};
		const first = createTreeGraph(options);
		const second = createTreeGraph(options);
		expect(hashBranchGraph(first)).toBe(hashBranchGraph(second));
		expect(validateBranchGraph(first)).toHaveLength(0);
		expect(computeTotalLength(first)).toBeGreaterThan(0);
		expect(computeApproximateBiomass(first)).toBeGreaterThan(0);
	});

	it("traverses, queries, rescales, and prunes", () => {
		const graph = createTreeGraph({
			maxDepth: 2,
			childrenPerApex: 2,
			initialLength: 1,
			initialRadius: 0.1,
			lengthDecay: 0.7,
			radiusDecay: 0.6,
			inclinationRadians: 0.5,
		});
		expect(depthFirstSegments(graph)).toHaveLength(graph.segments.length);
		expect(findTerminalSegments(graph).length).toBeGreaterThan(0);
		expect(querySegments(graph, { order: 1 }).length).toBeGreaterThan(0);
		const scaled = rescaleBranchGraph(graph, 2);
		expect(computeTotalLength(scaled)).toBeCloseTo(computeTotalLength(graph) * 2, 8);
		const pruned = pruneBranchGraph(graph, (segment) => segment.branchOrder === 0);
		expect(pruned.segments.length).toBeLessThan(graph.segments.length);
	});
});
