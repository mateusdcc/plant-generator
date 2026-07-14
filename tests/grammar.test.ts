import { describe, expect, it } from "vitest";
import {
	IncrementalDerivationSession,
	compileGrammar,
	derive,
	symbol,
	XorShift32,
	selectWeightedIndex,
	wordToAxialTree,
	rewriteEdges,
	rewriteNodes,
	type GrammarSpec,
} from "../src";

function compile(spec: GrammarSpec) {
	const result = compileGrammar(spec);
	expect(result.diagnostics.filter((value) => value.severity === "error")).toHaveLength(0);
	expect(result.grammar).toBeDefined();
	return result.grammar!;
}

describe("random and rewriting", () => {
	it("repeats the PRNG stream and integer range", () => {
		const first = new XorShift32(12345);
		const second = new XorShift32(12345);
		for (let index = 0; index < 100; index++) expect(first.nextNumber()).toBe(second.nextNumber());
		expect(first.nextInteger(3, 3)).toBe(3);
	});

	it("selects only valid weighted indexes", () => {
		const random = new XorShift32(9);
		for (let index = 0; index < 100; index++) expect(selectWeightedIndex([0, 1, 0], random)).toBe(1);
	});

	it("rewrites in parallel with identity and empty successors", () => {
		const grammar = compile({
			alphabet: [{ id: "A" }, { id: "B" }],
			axiom: [symbol("A"), symbol("B")],
			productions: [
				{ id: "double", predecessor: "A", successor: [symbol("A"), symbol("A")] },
				{ id: "erase", predecessor: "B", successor: [] },
			],
		});
		expect(derive(grammar, { iterations: 2, seed: 1 }).word.map((value) => value.id)).toEqual(["A", "A", "A", "A"]);
	});

	it("repeats stochastic derivation from the same seed", () => {
		const grammar = compile({
			alphabet: [{ id: "A" }, { id: "B" }, { id: "C" }],
			axiom: [symbol("A"), symbol("A"), symbol("A")],
			productions: [
				{ id: "b", predecessor: "A", successor: [symbol("B")], weight: 1 },
				{ id: "c", predecessor: "A", successor: [symbol("C")], weight: 2 },
			],
		});
		const first = derive(grammar, { iterations: 1, seed: 77 });
		const second = derive(grammar, { iterations: 1, seed: 77 });
		expect(first.word).toEqual(second.word);
	});

	it("prioritizes context-sensitive and parametric productions", () => {
		const grammar = compile({
			alphabet: [{ id: "L" }, { id: "A" }, { id: "R" }, { id: "X" }, { id: "Y" }],
			axiom: [symbol("L"), symbol("A", 4), symbol("R")],
			productions: [
				{ id: "fallback", predecessor: "A", successor: [symbol("X")] },
				{
					id: "context",
					predecessor: "A",
					leftContext: ["L"],
					rightContext: ["R"],
					condition: ({ symbol: value }) => value.parameters[0] === 4,
					successor: ({ symbol: value }) => [symbol("Y", (value.parameters[0] as number) + 1)],
				},
			],
		});
		const result = derive(grammar, { iterations: 1, seed: 1 });
		expect(result.word[1]).toEqual(symbol("Y", 5));
	});

	it("matches axial context across side branches", () => {
		const grammar = compile({
			alphabet: ["A", "B", "C", "X", "[", "]"].map((id) => ({ id })),
			axiom: [symbol("A"), symbol("["), symbol("X"), symbol("]"), symbol("B")],
			productions: [
				{ id: "signal", predecessor: "B", leftContext: ["A"], contextMode: "axial", successor: [symbol("C")] },
			],
			branchOpenSymbol: "[",
			branchCloseSymbol: "]",
		});
		expect(derive(grammar, { iterations: 1, seed: 1 }).word.at(-1)?.id).toBe("C");
	});

	it("incremental and one-shot derivation agree", () => {
		const grammar = compile({
			alphabet: [{ id: "F" }],
			axiom: [symbol("F")],
			productions: [{ id: "grow", predecessor: "F", successor: [symbol("F"), symbol("F")] }],
		});
		const expected = derive(grammar, { iterations: 6, seed: 4 });
		const session = new IncrementalDerivationSession(grammar, { iterations: 6, seed: 4 });
		while (!session.isComplete()) session.step(3);
		expect(session.getResult()?.word).toEqual(expected.word);
	});

	it("builds an axial tree and diagnoses invalid stacks", () => {
		const tree = wordToAxialTree([symbol("A"), symbol("["), symbol("B"), symbol("]"), symbol("C")]);
		expect(tree.nodes).toHaveLength(3);
		expect(tree.diagnostics).toHaveLength(0);
		expect(wordToAxialTree([symbol("]")]).diagnostics[0]?.code).toBe("UNBALANCED_BRANCH");
	});

	it("performs edge and node replacement through ports", () => {
		const graph = {
			nodes: [
				{ id: 0, label: "start", attributes: {} },
				{ id: 1, label: "bud", attributes: {} },
			],
			edges: [{ id: 0, source: 0, target: 1, label: "edge", attributes: {} }],
		};
		const replacement = {
			nodes: [
				{ id: 0, label: "entry", attributes: {} },
				{ id: 1, label: "middle", attributes: {} },
				{ id: 2, label: "exit", attributes: {} },
			],
			edges: [
				{ id: 0, source: 0, target: 1, label: "edge", attributes: {} },
				{ id: 1, source: 1, target: 2, label: "edge", attributes: {} },
			],
			entryNodeId: 0,
			exitNodeId: 2,
		};
		expect(rewriteEdges(graph, [{ id: "split", predecessorLabel: "edge", replacement }]).edges).toHaveLength(2);
		expect(rewriteNodes(graph, [{ id: "bud", predecessorLabel: "bud", replacement }]).nodes).toHaveLength(4);
	});
});

describe("grammar failures", () => {
	it("rejects weights, undeclared symbols, and unbalanced branches", () => {
		const result = compileGrammar({
			alphabet: [{ id: "A" }, { id: "[" }, { id: "]" }],
			axiom: [symbol("A"), symbol("[")],
			productions: [{ id: "bad", predecessor: "A", successor: [], weight: 0 }],
			branchOpenSymbol: "[",
			branchCloseSymbol: "]",
		});
		expect(result.grammar).toBeUndefined();
		expect(result.diagnostics.map((value) => value.code)).toContain("INVALID_WEIGHT");
		expect(result.diagnostics.map((value) => value.code)).toContain("UNBALANCED_BRANCH");
	});
});
