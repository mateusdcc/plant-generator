import { describe, expect, it } from "vitest";
import {
	GrowthHandle,
	PlantTimeline,
	approximateBoxCountingDimension,
	cellMapToMesh,
	createCellVolume,
	createGrowthFunction,
	createKeyframedGrowth,
	createPlanarCellLayer,
	createPlantIFS,
	createSierpinskiIFS,
	createSphericalCellLayer,
	divideCells,
	estimateIFSBounds,
	evaluateTimedWord,
	sampleIFS,
	symbol,
	validateCellMap,
	validateMesh,
} from "../src";

describe("timed development", () => {
	it("keeps built-in growth functions bounded and endpoint-correct", () => {
		for (const kind of [
			"constant",
			"linear",
			"inverse-linear",
			"smoothstep",
			"smootherstep",
			"exponential",
			"ease-in",
			"ease-out",
			"ease-in-out",
			"logistic",
		] as const) {
			const fn = createGrowthFunction(kind);
			for (let index = 0; index <= 20; index++) {
				const value = fn.evaluate(index / 20);
				expect(Number.isFinite(value)).toBe(true);
				expect(value).toBeGreaterThanOrEqual(0);
				expect(value).toBeLessThanOrEqual(1);
			}
		}
	});

	it("interpolates keyframes and channel handles", () => {
		const curve = createKeyframedGrowth("test", [
			{ time: 0, value: 0 },
			{ time: 0.5, value: 1 },
			{ time: 1, value: 0.5 },
		]);
		expect(curve.evaluate(0.25)).toBeCloseTo(0.5);
		const handle = new GrowthHandle(10, 5, { length: curve });
		expect(handle.evaluate(10).length).toBe(0);
		expect(handle.evaluate(12.5).length).toBe(1);
	});

	it("evaluates and scrubs timed words without stepping frames", () => {
		const word = [
			{ symbol: symbol("A"), birthTime: 0, lifespan: 5 },
			{ symbol: symbol("B"), birthTime: 3 },
		];
		expect(evaluateTimedWord(word, 2).map((value) => value.symbol.id)).toEqual(["A"]);
		const timeline = new PlantTimeline(word);
		const late = timeline.evaluate(6);
		const earlyAgain = timeline.evaluate(1);
		expect(late.map((value) => value.symbol.id)).toEqual(["B"]);
		expect(earlyAgain.map((value) => value.symbol.id)).toEqual(["A"]);
		expect(timeline.events()).toHaveLength(3);
	});
});

describe("cellular structures", () => {
	it("validates, subdivides, and triangulates a planar map", () => {
		const base = createPlanarCellLayer(2, 2);
		expect(validateCellMap(base)).toHaveLength(0);
		const divided = divideCells(base, (face) => face.id % 2 === 0);
		expect(divided.faces.length).toBeGreaterThan(base.faces.length);
		expect(validateCellMap(divided)).toHaveLength(0);
		expect(validateMesh(cellMapToMesh(divided))).toHaveLength(0);
	});

	it("creates spherical layers and basic 3D adjacency", () => {
		const sphere = createSphericalCellLayer(8, 4, 2);
		for (const vertex of sphere.vertices) {
			const radius = Math.hypot(vertex.position.x, vertex.position.y, vertex.position.z);
			expect(radius).toBeCloseTo(2, 6);
		}
		const volume = createCellVolume(2, 2, 2);
		expect(volume).toHaveLength(8);
		expect(volume[0]?.neighborIds).toHaveLength(3);
	});
});

describe("iterated function systems", () => {
	it("samples deterministically and estimates finite bounds", () => {
		const first = sampleIFS(createPlantIFS(), { count: 500, seed: 12 });
		const second = sampleIFS(createPlantIFS(), { count: 500, seed: 12 });
		expect(first).toEqual(second);
		const bounds = estimateIFSBounds(first);
		expect(bounds.max.y).toBeGreaterThan(bounds.min.y);
	});

	it("supports educational dimension estimates", () => {
		const points = sampleIFS(createSierpinskiIFS(), { count: 5000, seed: 5 });
		const dimension = approximateBoxCountingDimension(points, 0.1, 0.05);
		expect(dimension).toBeGreaterThan(1);
		expect(dimension).toBeLessThan(2.2);
	});
});
