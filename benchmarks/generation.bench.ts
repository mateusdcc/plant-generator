import { bench, describe } from "vitest";
import {
	PLANT_PRESETS,
	PlantCompiler,
	PlantGenerator,
	PlantTimeline,
	cellMapToMesh,
	compileGrammar,
	createPlanarCellLayer,
	createTubeMesh,
	derive,
	divideCells,
	placePlanarPhyllotaxis,
	symbol,
	vec3,
} from "../src";

const flowering = PlantCompiler.compile(PLANT_PRESETS["flowering-stem"]!);
const tree = PlantCompiler.compile(PLANT_PRESETS["broad-canopy-tree"]!);
const contextGrammar = compileGrammar({
	alphabet: ["L", "A", "R", "X"].map((id) => ({ id })),
	axiom: [symbol("L"), ...new Array(200).fill(undefined).map(() => symbol("A")), symbol("R")],
	productions: [
		{ id: "context", predecessor: "A", leftContext: ["L"], ignoreSymbols: ["A"], successor: [symbol("X")] },
	],
}).grammar!;
const timeline = new PlantTimeline(
	new Array(500).fill(undefined).map((_, index) => ({ symbol: symbol("F"), birthTime: index * 0.01, lifespan: 5 })),
);

describe("generation baselines", () => {
	bench("small flowering plant", () => PlantGenerator.generate(flowering, { seed: 1, iterations: 3 }));
	bench("medium tree", () => PlantGenerator.generate(tree, { seed: 2, iterations: 4 }));
	bench("large bounded tree", () =>
		PlantGenerator.generate(tree, {
			seed: 3,
			iterations: 7,
			limits: { maxSymbols: 20_000, maxSegments: 4_000, maxVertices: 100_000 },
		}),
	);
	bench("context-sensitive grammar", () => derive(contextGrammar, { seed: 4, iterations: 2 }));
	bench("timed reevaluation", () => timeline.evaluate(3.75));
	bench("tube mesh generation", () =>
		createTubeMesh([vec3(0, 0, 0), vec3(0.2, 1, 0), vec3(-0.1, 2, 0.2), vec3(0, 3, 0.4)], [0.4, 0.3, 0.2, 0.05], {
			radialResolution: 12,
			capStart: true,
			capEnd: true,
		}),
	);
	bench("phyllotactic placement", () => placePlanarPhyllotaxis({ count: 2_000, seed: 5 }));
	bench("cellular subdivision", () => cellMapToMesh(divideCells(createPlanarCellLayer(16, 16), () => true)));
	bench("part render preparation", () => {
		const result = PlantGenerator.generate(tree, { seed: 6, iterations: 4 });
		return result.branchGraph.segments.map((segment) => ({
			midpoint: vec3(
				(segment.start.x + segment.end.x) / 2,
				(segment.start.y + segment.end.y) / 2,
				(segment.start.z + segment.end.z) / 2,
			),
			length: math.sqrt(
				math.pow(segment.end.x - segment.start.x, 2) +
					math.pow(segment.end.y - segment.start.y, 2) +
					math.pow(segment.end.z - segment.start.z, 2),
			),
		}));
	});
	bench("incremental generation", () => {
		const session = PlantGenerator.createSession(tree, { seed: 7, iterations: 5 });
		while (!session.isComplete()) session.step(50);
		return session.getResult();
	});
});
