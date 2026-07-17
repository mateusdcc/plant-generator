import { lerp3, length3, sub3, type Vec3 } from "../math/vector";
import type { BranchGraph, BranchSegment } from "../topology/branch-graph";

/** Normalized interval during which one structural element develops. @public */
export interface StructuralGrowthSpan {
	readonly start: number;
	readonly finish: number;
}

/** Minimal organ relationship required to derive developmental timing. @public */
export interface StructuralGrowthOrgan {
	readonly segmentId: number;
}

/** Precomputed, renderer-neutral timing for branch segments and their organs. @public */
export interface StructuralGrowthSchedule {
	readonly segmentSpans: readonly StructuralGrowthSpan[];
	readonly organSpans: readonly StructuralGrowthSpan[];
	readonly structuralFinish: number;
}

/** Options controlling how normalized plant time is divided between structure and organs. @public */
export interface StructuralGrowthScheduleOptions {
	/** Normalized duration reserved for organ emergence after a host segment matures. */
	readonly organGrowthFraction?: number;
}

/** Renderer-neutral geometry for a segment elongated from its fixed base. @public */
export interface ElongatedSegment {
	readonly start: Vec3;
	readonly end: Vec3;
	readonly center: Vec3;
	readonly length: number;
}

interface PendingSegment {
	readonly index: number;
	readonly startDistance: number;
}

function smootherstep(value: number): number {
	const age = math.clamp(value, 0, 1);
	return age * age * age * (age * (age * 6 - 15) + 10);
}

/** Evaluates one local developmental interval from raw normalized plant time. @public */
export function evaluateStructuralGrowthSpan(span: StructuralGrowthSpan, growth: number): number {
	const time = math.clamp(growth, 0, 1);
	const duration = span.finish - span.start;
	if (duration <= 1e-9) return time >= span.finish ? 1 : 0;
	return smootherstep((time - span.start) / duration);
}

/** Computes partial segment geometry without moving its base attachment. @public */
export function elongateSegment(segment: Pick<BranchSegment, "start" | "end">, localGrowth: number): ElongatedSegment {
	const growth = math.clamp(localGrowth, 0, 1);
	const partialEnd = lerp3(segment.start, segment.end, growth);
	return {
		start: segment.start,
		end: partialEnd,
		center: lerp3(segment.start, partialEnd, 0.5),
		length: length3(sub3(segment.end, segment.start)) * growth,
	};
}

/**
 * Builds an acropetal growth schedule from cumulative root-to-tip path distance.
 *
 * Parent spans always finish before child spans begin. Siblings at the same path
 * distance therefore emerge together regardless of segment emission order.
 * Organs begin only after their host segment has matured.
 *
 * @public
 */
export function createStructuralGrowthSchedule(
	graph: BranchGraph,
	organs: readonly StructuralGrowthOrgan[] = [],
	options: StructuralGrowthScheduleOptions = {},
): StructuralGrowthSchedule {
	const segmentCount = graph.segments.size();
	const children: Record<number, number[]> = {};
	const roots = new Array<number>();

	for (let index = 0; index < segmentCount; index++) {
		const segment = graph.segments[index];
		if (segment === undefined) continue;
		const parent = segment.parentSegmentId;
		if (parent === undefined || parent === index || graph.segments[parent] === undefined) {
			roots.push(index);
			continue;
		}
		const values = children[parent] ?? [];
		values.push(index);
		children[parent] = values;
	}

	const startDistances = new Array<number>();
	const finishDistances = new Array<number>();
	const visited: Record<number, boolean> = {};
	const pending = new Array<PendingSegment>();
	for (const root of roots) pending.push({ index: root, startDistance: 0 });

	let maximumDistance = 0;
	let cursor = 0;
	const visitPending = () => {
		while (cursor < pending.size()) {
			const value = pending[cursor++];
			if (value === undefined || visited[value.index] === true) continue;
			const segment = graph.segments[value.index];
			if (segment === undefined) continue;
			visited[value.index] = true;
			const effectiveLength = math.max(length3(sub3(segment.end, segment.start)), 1e-6);
			const finishDistance = value.startDistance + effectiveLength;
			startDistances[value.index] = value.startDistance;
			finishDistances[value.index] = finishDistance;
			maximumDistance = math.max(maximumDistance, finishDistance);
			for (const child of children[value.index] ?? []) {
				pending.push({ index: child, startDistance: finishDistance });
			}
		}
	};

	visitPending();
	// Invalid cyclic or rootless input is still rendered deterministically instead
	// of producing undefined timing. Valid BranchGraphs never enter this fallback.
	for (let index = 0; index < segmentCount; index++) {
		if (visited[index] === true) continue;
		pending.push({ index, startDistance: 0 });
		visitPending();
	}

	const organGrowthFraction = organs.size() > 0 ? math.clamp(options.organGrowthFraction ?? 0.15, 0, 0.95) : 0;
	const structuralFinish = 1 - organGrowthFraction;
	const denominator = math.max(maximumDistance, 1e-6);
	const segmentSpans = new Array<StructuralGrowthSpan>();
	for (let index = 0; index < segmentCount; index++) {
		segmentSpans.push({
			start: ((startDistances[index] ?? 0) / denominator) * structuralFinish,
			finish: ((finishDistances[index] ?? denominator) / denominator) * structuralFinish,
		});
	}

	const organSpans = new Array<StructuralGrowthSpan>();
	for (const organ of organs) {
		const hostFinish = segmentSpans[organ.segmentId]?.finish ?? structuralFinish;
		organSpans.push({
			start: hostFinish,
			finish: math.min(1, hostFinish + organGrowthFraction),
		});
	}

	return { segmentSpans, organSpans, structuralFinish };
}
