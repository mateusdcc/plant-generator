import { symbol } from "./symbols";
import type { GrammarSpec } from "./grammar";

function alphabet(ids: readonly string[]) {
	const result = new Array<{ id: string }>();
	for (const id of ids) result.push({ id });
	return result;
}

/** Canonical grammar examples useful for correctness tests and education. @public */
export const FRACTAL_GRAMMARS: Readonly<Record<string, GrammarSpec>> = {
	koch: {
		alphabet: alphabet(["F", "+", "-"]),
		axiom: [symbol("F")],
		productions: [
			{
				id: "koch-edge",
				predecessor: "F",
				successor: [
					symbol("F"),
					symbol("+", math.pi / 3),
					symbol("F"),
					symbol("-", (2 * math.pi) / 3),
					symbol("F"),
					symbol("+", math.pi / 3),
					symbol("F"),
				],
			},
		],
	},
	dragon: {
		alphabet: alphabet(["F", "X", "Y", "+", "-"]),
		axiom: [symbol("F"), symbol("X")],
		productions: [
			{
				id: "dragon-x",
				predecessor: "X",
				successor: [symbol("X"), symbol("+", math.pi / 2), symbol("Y"), symbol("F"), symbol("+")],
			},
			{
				id: "dragon-y",
				predecessor: "Y",
				successor: [symbol("-", math.pi / 2), symbol("F"), symbol("X"), symbol("-", math.pi / 2), symbol("Y")],
			},
		],
	},
	hilbert: {
		alphabet: alphabet(["F", "A", "B", "+", "-"]),
		axiom: [symbol("A")],
		productions: [
			{
				id: "hilbert-a",
				predecessor: "A",
				successor: [
					symbol("+", math.pi / 2),
					symbol("B"),
					symbol("F"),
					symbol("-", math.pi / 2),
					symbol("A"),
					symbol("F"),
					symbol("A"),
					symbol("-", math.pi / 2),
					symbol("F"),
					symbol("B"),
					symbol("+", math.pi / 2),
				],
			},
			{
				id: "hilbert-b",
				predecessor: "B",
				successor: [
					symbol("-", math.pi / 2),
					symbol("A"),
					symbol("F"),
					symbol("+", math.pi / 2),
					symbol("B"),
					symbol("F"),
					symbol("B"),
					symbol("+", math.pi / 2),
					symbol("F"),
					symbol("A"),
					symbol("-", math.pi / 2),
				],
			},
		],
	},
	sierpinski: {
		alphabet: alphabet(["F", "G", "+", "-"]),
		axiom: [symbol("F"), symbol("-", (2 * math.pi) / 3), symbol("G"), symbol("-", (2 * math.pi) / 3), symbol("G")],
		productions: [
			{
				id: "sierpinski-f",
				predecessor: "F",
				successor: [
					symbol("F"),
					symbol("-", (2 * math.pi) / 3),
					symbol("G"),
					symbol("+", (2 * math.pi) / 3),
					symbol("F"),
					symbol("+", (2 * math.pi) / 3),
					symbol("G"),
					symbol("-", (2 * math.pi) / 3),
					symbol("F"),
				],
			},
			{ id: "sierpinski-g", predecessor: "G", successor: [symbol("G"), symbol("G")] },
		],
	},
	"plant-like": {
		alphabet: alphabet(["F", "X", "+", "-", "[", "]"]),
		axiom: [symbol("X")],
		productions: [
			{
				id: "plant-x",
				predecessor: "X",
				successor: [
					symbol("F"),
					symbol("+", math.pi / 7),
					symbol("["),
					symbol("["),
					symbol("X"),
					symbol("]"),
					symbol("-", math.pi / 7),
					symbol("X"),
					symbol("]"),
					symbol("-", math.pi / 7),
					symbol("F"),
					symbol("["),
					symbol("-", math.pi / 7),
					symbol("F"),
					symbol("X"),
					symbol("]"),
					symbol("+", math.pi / 7),
					symbol("X"),
				],
			},
			{ id: "plant-f", predecessor: "F", successor: [symbol("F"), symbol("F")] },
		],
		branchOpenSymbol: "[",
		branchCloseSymbol: "]",
	},
};
