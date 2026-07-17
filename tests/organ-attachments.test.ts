import { describe, expect, it } from "vitest";
import { PlantCompiler, PlantGenerator, symbol, type ModelSpecification } from "../src";

describe("generated organ sockets", () => {
	it("preserves explicit leaf and flower modules as positioned organs", () => {
		const specification: ModelSpecification = {
			schemaVersion: 1,
			id: "explicit-organs",
			grammar: {
				alphabet: ["F", "+", "[", "]", "L", "K"].map((id) => ({ id })),
				axiom: [
					symbol("F"),
					symbol("L"),
					symbol("["),
					symbol("+", Math.PI / 2),
					symbol("F"),
					symbol("K"),
					symbol("]"),
				],
				productions: [],
				branchOpenSymbol: "[",
				branchCloseSymbol: "]",
			},
			organs: { terminalLeafKind: "leaf", terminalFlowerKind: "flower" },
		};
		const result = PlantGenerator.generate(PlantCompiler.compile(specification), { seed: 7, iterations: 0 });

		expect(result.branchGraph.attachments).toHaveLength(2);
		expect(result.organs.map((organ) => organ.kind)).toEqual(["leaf", "flower"]);
		for (const organ of result.organs) {
			const supportingSegment = result.branchGraph.segments[organ.segmentId];
			expect(supportingSegment).toBeDefined();
			expect(organ.transform.position).toEqual(supportingSegment?.end);
		}
	});

	it("keeps terminal fallback organs on tips without explicit sockets", () => {
		const specification: ModelSpecification = {
			schemaVersion: 1,
			id: "mixed-explicit-and-terminal-organs",
			grammar: {
				alphabet: ["F", "+", "[", "]", "L"].map((id) => ({ id })),
				axiom: [symbol("F"), symbol("L"), symbol("["), symbol("+", Math.PI / 2), symbol("F"), symbol("]")],
				productions: [],
				branchOpenSymbol: "[",
				branchCloseSymbol: "]",
			},
			organs: { terminalLeafKind: "leaf" },
		};
		const result = PlantGenerator.generate(PlantCompiler.compile(specification), { seed: 7, iterations: 0 });

		expect(result.branchGraph.attachments).toHaveLength(1);
		expect(result.organs).toHaveLength(2);
		expect(new Set(result.organs.map((organ) => organ.segmentId))).toEqual(new Set([0, 1]));
	});

	it("applies maxOrgans to explicit sockets and terminal fallback organs together", () => {
		const specification: ModelSpecification = {
			schemaVersion: 1,
			id: "bounded-organs",
			grammar: {
				alphabet: ["F", "L"].map((id) => ({ id })),
				axiom: [symbol("F"), symbol("L")],
				productions: [],
			},
			organs: { terminalLeafKind: "leaf" },
		};
		const result = PlantGenerator.generate(PlantCompiler.compile(specification), {
			seed: 7,
			iterations: 0,
			limits: { maxOrgans: 0 },
		});

		expect(result.branchGraph.attachments).toHaveLength(0);
		expect(result.organs).toHaveLength(0);
		expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("LIMIT_ORGANS");
	});

	it("honors zero and fractional terminal organ densities", () => {
		const specification: ModelSpecification = {
			schemaVersion: 1,
			id: "terminal-organ-density",
			grammar: {
				alphabet: ["F", "[", "]"].map((id) => ({ id })),
				axiom: [
					symbol("["),
					symbol("F"),
					symbol("]"),
					symbol("["),
					symbol("F"),
					symbol("]"),
					symbol("["),
					symbol("F"),
					symbol("]"),
					symbol("["),
					symbol("F"),
					symbol("]"),
				],
				productions: [],
				branchOpenSymbol: "[",
				branchCloseSymbol: "]",
			},
			organs: {
				terminalLeafKind: "leaf",
				terminalFlowerKind: "flower",
				leafDensity: 0.5,
				flowerDensity: 0,
			},
		};
		const result = PlantGenerator.generate(PlantCompiler.compile(specification), { seed: 7, iterations: 0 });

		expect(result.branchGraph.segments).toHaveLength(4);
		expect(result.organs.map((organ) => organ.kind)).toEqual(["leaf", "leaf"]);
		expect(result.organs.map((organ) => organ.segmentId)).toEqual([0, 2]);
	});
});
