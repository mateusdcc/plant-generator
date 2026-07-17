import { describe, expect, it } from "vitest";
import {
	createStructuralGrowthSchedule,
	elongateSegment,
	evaluateStructuralGrowthSpan,
	interpret3D,
	symbol,
	vec3,
} from "../src";

describe("structural growth scheduling", () => {
	it("advances from the base along cumulative path distance", () => {
		const graph = interpret3D([symbol("F"), symbol("F"), symbol("F")]).branchGraph;
		const schedule = createStructuralGrowthSchedule(graph);
		const localGrowth = schedule.segmentSpans.map((span) => evaluateStructuralGrowthSpan(span, 0.5));

		expect(localGrowth[0]).toBe(1);
		expect(localGrowth[1]).toBeCloseTo(0.5);
		expect(localGrowth[2]).toBe(0);
		expect(schedule.segmentSpans[0]?.finish).toBeCloseTo(schedule.segmentSpans[1]?.start ?? -1);
		expect(schedule.segmentSpans[1]?.finish).toBeCloseTo(schedule.segmentSpans[2]?.start ?? -1);
	});

	it("grows equal-distance siblings together and completes every parent first", () => {
		const graph = interpret3D([
			symbol("F"),
			symbol("["),
			symbol("+", math.pi / 4),
			symbol("F"),
			symbol("]"),
			symbol("["),
			symbol("-", math.pi / 4),
			symbol("F"),
			symbol("]"),
		]).branchGraph;
		const schedule = createStructuralGrowthSchedule(graph);

		expect(schedule.segmentSpans[1]).toEqual(schedule.segmentSpans[2]);
		for (let step = 0; step <= 20; step++) {
			const time = step / 20;
			for (const segment of graph.segments) {
				if (segment.parentSegmentId === undefined) continue;
				const child = evaluateStructuralGrowthSpan(schedule.segmentSpans[segment.id]!, time);
				if (child <= 0) continue;
				const parent = evaluateStructuralGrowthSpan(schedule.segmentSpans[segment.parentSegmentId]!, time);
				expect(parent).toBe(1);
			}
		}
	});

	it("delays organ emergence until its host segment is mature", () => {
		const graph = interpret3D([symbol("F"), symbol("F"), symbol("F")]).branchGraph;
		const schedule = createStructuralGrowthSchedule(graph, [{ segmentId: 2 }]);
		const hostSpan = schedule.segmentSpans[2]!;
		const organSpan = schedule.organSpans[0]!;

		expect(schedule.structuralFinish).toBeCloseTo(0.85);
		expect(organSpan.start).toBeCloseTo(hostSpan.finish);
		expect(evaluateStructuralGrowthSpan(organSpan, organSpan.start)).toBe(0);
		expect(evaluateStructuralGrowthSpan(organSpan, (organSpan.start + organSpan.finish) / 2)).toBeCloseTo(0.5);
		expect(evaluateStructuralGrowthSpan(organSpan, 1)).toBe(1);
	});

	it("elongates a partial segment from its fixed base", () => {
		const geometry = elongateSegment({ start: vec3(0, 0, 0), end: vec3(0, 4, 0) }, 0.25);

		expect(geometry.start).toEqual(vec3(0, 0, 0));
		expect(geometry.end).toEqual(vec3(0, 1, 0));
		expect(geometry.center).toEqual(vec3(0, 0.5, 0));
		expect(geometry.length).toBe(1);
	});
});
