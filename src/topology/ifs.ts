import { XorShift32, selectWeightedIndex, type RandomSource } from "../math/random";
import { add3, scale3, type Vec3, vec3 } from "../math/vector";
import type { Bounds3 } from "./branch-graph";

/** Weighted three-dimensional affine transform used by an IFS. @public */
export interface WeightedAffineTransform {
	readonly id: string;
	readonly xAxis: Vec3;
	readonly yAxis: Vec3;
	readonly zAxis: Vec3;
	readonly translation: Vec3;
	readonly weight: number;
	readonly allowedPreviousIds?: readonly string[];
}

/** Applies an affine transform. @public */
export function applyAffine(transform: WeightedAffineTransform, point: Vec3): Vec3 {
	return add3(
		transform.translation,
		add3(
			scale3(transform.xAxis, point.x),
			add3(scale3(transform.yAxis, point.y), scale3(transform.zAxis, point.z)),
		),
	);
}

/** IFS point with the transform that produced it. @public */
export interface IFSPoint {
	readonly point: Vec3;
	readonly transformId: string;
	readonly iteration: number;
}

function permits(transform: WeightedAffineTransform, previousId: string | undefined): boolean {
	if (transform.allowedPreviousIds === undefined || previousId === undefined) return true;
	for (const id of transform.allowedPreviousIds) if (id === previousId) return true;
	return false;
}

/** Deterministically samples a weighted, optionally state-controlled IFS. @public */
export function sampleIFS(
	transforms: readonly WeightedAffineTransform[],
	options: {
		readonly count: number;
		readonly burnIn?: number;
		readonly seed?: number;
		readonly random?: RandomSource;
		readonly initialPoint?: Vec3;
	},
): readonly IFSPoint[] {
	assert(transforms.size() > 0, "IFS needs at least one transform");
	const random = options.random ?? new XorShift32(options.seed ?? 1);
	const burnIn = math.max(0, math.floor(options.burnIn ?? 20));
	const total = math.max(0, math.floor(options.count)) + burnIn;
	const points = new Array<IFSPoint>();
	let point = options.initialPoint ?? vec3(0, 0, 0);
	let previousId: string | undefined;
	for (let iteration = 0; iteration < total; iteration++) {
		const eligible = new Array<WeightedAffineTransform>();
		const weights = new Array<number>();
		for (const transform of transforms) {
			if (!permits(transform, previousId)) continue;
			assert(transform.weight > 0, "IFS weights must be positive");
			eligible.push(transform);
			weights.push(transform.weight);
		}
		assert(eligible.size() > 0, "IFS state has no eligible transform");
		const transform = eligible[selectWeightedIndex(weights, random)];
		if (transform === undefined) continue;
		point = applyAffine(transform, point);
		previousId = transform.id;
		if (iteration >= burnIn) points.push({ point, transformId: transform.id, iteration: iteration - burnIn });
	}
	return points;
}

/** Computes IFS sample bounds. @public */
export function estimateIFSBounds(points: readonly IFSPoint[]): Bounds3 {
	if (points.size() === 0) return { min: vec3(0, 0, 0), max: vec3(0, 0, 0) };
	let min = vec3(math.huge, math.huge, math.huge);
	let max = vec3(-math.huge, -math.huge, -math.huge);
	for (const value of points) {
		const point = value.point;
		min = vec3(math.min(min.x, point.x), math.min(min.y, point.y), math.min(min.z, point.z));
		max = vec3(math.max(max.x, point.x), math.max(max.y, point.y), math.max(max.z, point.z));
	}
	return { min, max };
}

/** Deterministic Sierpinski-triangle IFS preset. @public */
export function createSierpinskiIFS(): readonly WeightedAffineTransform[] {
	return [
		{
			id: "left",
			xAxis: vec3(0.5, 0, 0),
			yAxis: vec3(0, 0.5, 0),
			zAxis: vec3(0, 0, 0.5),
			translation: vec3(0, 0, 0),
			weight: 1,
		},
		{
			id: "right",
			xAxis: vec3(0.5, 0, 0),
			yAxis: vec3(0, 0.5, 0),
			zAxis: vec3(0, 0, 0.5),
			translation: vec3(0.5, 0, 0),
			weight: 1,
		},
		{
			id: "top",
			xAxis: vec3(0.5, 0, 0),
			yAxis: vec3(0, 0.5, 0),
			zAxis: vec3(0, 0, 0.5),
			translation: vec3(0.25, 0.4330127, 0),
			weight: 1,
		},
	];
}

/** Barnsley-style plant IFS independently expressed as affine data. @public */
export function createPlantIFS(): readonly WeightedAffineTransform[] {
	return [
		{
			id: "stem",
			xAxis: vec3(0, 0, 0),
			yAxis: vec3(0, 0.16, 0),
			zAxis: vec3(0, 0, 0),
			translation: vec3(0, 0, 0),
			weight: 0.01,
		},
		{
			id: "successor",
			xAxis: vec3(0.85, -0.04, 0),
			yAxis: vec3(0.04, 0.85, 0),
			zAxis: vec3(0, 0, 0.85),
			translation: vec3(0, 1.6, 0),
			weight: 0.85,
		},
		{
			id: "left",
			xAxis: vec3(0.2, 0.23, 0),
			yAxis: vec3(-0.26, 0.22, 0),
			zAxis: vec3(0, 0, 0.2),
			translation: vec3(0, 1.6, 0),
			weight: 0.07,
		},
		{
			id: "right",
			xAxis: vec3(-0.15, 0.26, 0),
			yAxis: vec3(0.28, 0.24, 0),
			zAxis: vec3(0, 0, 0.2),
			translation: vec3(0, 0.44, 0),
			weight: 0.07,
		},
	];
}

/** Approximate two-scale box-counting dimension for point samples. @public */
export function approximateBoxCountingDimension(
	points: readonly IFSPoint[],
	coarseSize: number,
	fineSize: number,
): number {
	assert(coarseSize > fineSize && fineSize > 0, "box sizes must satisfy coarse > fine > 0");
	const countBoxes = (size: number) => {
		const occupied: Record<string, boolean> = {};
		let count = 0;
		for (const value of points) {
			const point = value.point;
			const key = `${math.floor(point.x / size)},${math.floor(point.y / size)},${math.floor(point.z / size)}`;
			if (occupied[key] !== true) {
				occupied[key] = true;
				count++;
			}
		}
		return count;
	};
	const coarse = countBoxes(coarseSize);
	const fine = countBoxes(fineSize);
	return coarse <= 0 || fine <= 0 ? 0 : math.log(fine / coarse) / math.log(coarseSize / fineSize);
}
