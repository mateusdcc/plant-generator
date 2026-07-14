import { XorShift32, type RandomSource } from "../math/random";
import { IDENTITY_FRAME, type Transform3, vec3 } from "../math/vector";

/** Golden angle in radians. @public */
export const GOLDEN_ANGLE = math.pi * (3 - math.sqrt(5));

/** Generic organ placement produced by mathematical phyllotaxis. @public */
export interface PhyllotacticPlacement {
	readonly index: number;
	readonly angle: number;
	readonly radialDistance: number;
	readonly transform: Transform3;
	readonly organRadius: number;
}

/** Optional deterministic local spacing relaxation. @public */
export interface SpacingPolicy {
	readonly minimumGap: number;
	readonly radialStep: number;
	readonly maxAttempts: number;
}

/** Planar phyllotaxis controls. @public */
export interface PlanarPhyllotaxisOptions {
	readonly count: number;
	readonly startIndex?: number;
	readonly divergenceAngle?: number;
	/** Computes radial distance for a mathematical organ index. */
	readonly radius?: (index: number) => number;
	/** Computes collision radius for a mathematical organ index. */
	readonly organRadius?: (index: number) => number;
	readonly jitter?: number;
	readonly seed?: number;
	readonly random?: RandomSource;
	readonly spacing?: SpacingPolicy;
}

function collides(
	placements: readonly PhyllotacticPlacement[],
	x: number,
	y: number,
	radius: number,
	gap: number,
): boolean {
	for (const placement of placements) {
		const dx = placement.transform.position.x - x;
		const dy = placement.transform.position.y - y;
		const minimum = placement.organRadius + radius + gap;
		if (dx * dx + dy * dy < minimum * minimum) return true;
	}
	return false;
}

/**
 * Produces generic transforms for Vogel-style planar phyllotaxis.
 *
 * @remarks Organ geometry is intentionally separate; these transforms can
 * place seeds, petals, fruit, or arbitrary Instances.
 * @public
 */
export function placePlanarPhyllotaxis(options: PlanarPhyllotaxisOptions): readonly PhyllotacticPlacement[] {
	const count = math.max(0, math.floor(options.count));
	const start = math.max(0, math.floor(options.startIndex ?? 0));
	const divergence = options.divergenceAngle ?? GOLDEN_ANGLE;
	const radiusFunction = options.radius ?? ((index: number) => math.sqrt(index));
	const organRadiusFunction = options.organRadius ?? (() => 0);
	const random = options.random ?? new XorShift32(options.seed ?? 1);
	const placements = new Array<PhyllotacticPlacement>();
	for (let offset = 0; offset < count; offset++) {
		const index = start + offset;
		const jitter = (random.nextNumber() * 2 - 1) * (options.jitter ?? 0);
		const angle = index * divergence + jitter;
		let radius = math.max(0, radiusFunction(index));
		const organRadius = math.max(0, organRadiusFunction(index));
		if (options.spacing !== undefined) {
			let attempts = 0;
			while (
				attempts < options.spacing.maxAttempts &&
				collides(
					placements,
					math.cos(angle) * radius,
					math.sin(angle) * radius,
					organRadius,
					options.spacing.minimumGap,
				)
			) {
				radius += options.spacing.radialStep;
				attempts++;
			}
		}
		placements.push({
			index,
			angle,
			radialDistance: radius,
			organRadius,
			transform: {
				position: vec3(math.cos(angle) * radius, math.sin(angle) * radius, 0),
				frame: IDENTITY_FRAME,
				scale: vec3(1, 1, 1),
			},
		});
	}
	return placements;
}

/** Cylindrical phyllotaxis controls for stems, cones, and succulent forms. @public */
export interface CylindricalPhyllotaxisOptions extends Omit<PlanarPhyllotaxisOptions, "radius" | "spacing"> {
	/** Computes cylinder or cone radius for a mathematical organ index. */
	readonly cylinderRadius?: (index: number) => number;
	/** Computes axial height for a mathematical organ index. */
	readonly height?: (index: number) => number;
}

/** Places organs on a configurable cylinder or cone. @public */
export function placeCylindricalPhyllotaxis(options: CylindricalPhyllotaxisOptions): readonly PhyllotacticPlacement[] {
	const count = math.max(0, math.floor(options.count));
	const start = math.max(0, math.floor(options.startIndex ?? 0));
	const divergence = options.divergenceAngle ?? GOLDEN_ANGLE;
	const radiusFunction = options.cylinderRadius ?? (() => 1);
	const heightFunction = options.height ?? ((index: number) => index * 0.2);
	const organRadiusFunction = options.organRadius ?? (() => 0);
	const random = options.random ?? new XorShift32(options.seed ?? 1);
	const placements = new Array<PhyllotacticPlacement>();
	for (let offset = 0; offset < count; offset++) {
		const index = start + offset;
		const angle = index * divergence + (random.nextNumber() * 2 - 1) * (options.jitter ?? 0);
		const radius = math.max(0, radiusFunction(index));
		const outward = vec3(math.cos(angle), math.sin(angle), 0);
		const frame = {
			heading: outward,
			left: vec3(math.sin(angle), -math.cos(angle), 0),
			up: vec3(0, 0, 1),
		};
		placements.push({
			index,
			angle,
			radialDistance: radius,
			organRadius: math.max(0, organRadiusFunction(index)),
			transform: {
				position: vec3(outward.x * radius, outward.y * radius, heightFunction(index)),
				frame,
				scale: vec3(1, 1, 1),
			},
		});
	}
	return placements;
}

/** Candidate visible spiral family and its angular error. @public */
export interface ParastichyCandidate {
	readonly count: number;
	readonly error: number;
}

/** Estimates low-error parastichy counts from a divergence angle. @public */
export function analyzeParastichies(divergenceAngle: number, maximumCount = 34): readonly ParastichyCandidate[] {
	const candidates = new Array<ParastichyCandidate>();
	for (let count = 1; count <= maximumCount; count++) {
		const rotations = (count * divergenceAngle) / (math.pi * 2);
		const angularError = math.abs(rotations - math.floor(rotations + 0.5));
		candidates.push({ count, error: angularError });
	}
	for (let index = 1; index < candidates.size(); index++) {
		const value = candidates[index];
		if (value === undefined) continue;
		let cursor = index - 1;
		while (cursor >= 0) {
			const previous = candidates[cursor];
			if (
				previous === undefined ||
				previous.error < value.error ||
				(previous.error === value.error && previous.count < value.count)
			)
				break;
			candidates[cursor + 1] = previous;
			cursor--;
		}
		candidates[cursor + 1] = value;
	}
	const result = new Array<ParastichyCandidate>();
	for (let index = 0; index < math.min(6, candidates.size()); index++) {
		const value = candidates[index];
		if (value !== undefined) result.push(value);
	}
	return result;
}
