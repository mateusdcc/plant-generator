import { compileGrammar, derive, symbol } from "@rbxts/plant-generator";

const compiled = compileGrammar({
	alphabet: ["signal", "bud", "active"].map((id) => ({ id })),
	axiom: [symbol("signal"), symbol("bud")],
	productions: [{ id: "activate", predecessor: "bud", leftContext: ["signal"], successor: [symbol("active")] }],
}).grammar;
assert(compiled !== undefined);
export const signaled = derive(compiled, { seed: 1, iterations: 1 });
