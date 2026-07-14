/** Stateful deterministic random source. @public */
export interface RandomSource {
	/** Returns the next value in the half-open interval [0, 1). */
	nextNumber(): number;
	/** Returns an integer in the inclusive requested range. */
	nextInteger(minInclusive: number, maxInclusive: number): number;
	/** Copies the stream at its current state. */
	clone(): RandomSource;
	/** Returns a serializable snapshot of the stream state. */
	getState(): number;
}

/**
 * Compact xorshift32 pseudo-random stream.
 *
 * @remarks This generator is selected for deterministic cross-runtime behavior,
 * not cryptographic security. Never use it for security-sensitive decisions.
 * @public
 */
export class XorShift32 implements RandomSource {
	private state: number;

	public constructor(seed: number) {
		const normalized = math.floor(seed) >>> 0;
		this.state = normalized === 0 ? 0x6d2b79f5 : normalized;
	}

	/** Advances and returns the next value in the half-open interval [0, 1). */
	public nextNumber(): number {
		let value = this.state;
		value ^= value << 13;
		value ^= value >>> 17;
		value ^= value << 5;
		this.state = value >>> 0;
		return this.state / 4294967296;
	}

	/** Advances and returns an integer in the inclusive requested range. */
	public nextInteger(minInclusive: number, maxInclusive: number): number {
		assert(maxInclusive >= minInclusive, "maxInclusive must not be less than minInclusive");
		const span = math.floor(maxInclusive) - math.ceil(minInclusive) + 1;
		return math.ceil(minInclusive) + math.floor(this.nextNumber() * span);
	}

	/** Copies the generator without advancing either stream. */
	public clone(): RandomSource {
		const copy = new XorShift32(1);
		copy.state = this.state;
		return copy;
	}

	/** Returns the current unsigned 32-bit state. */
	public getState(): number {
		return this.state;
	}
}

/** Selects an index from validated nonnegative weights. @public */
export function selectWeightedIndex(weights: readonly number[], random: RandomSource): number {
	let total = 0;
	for (const weight of weights) {
		assert(weight >= 0 && weight === weight, "weights must be finite and nonnegative");
		total += weight;
	}
	assert(total > 0, "at least one weight must be positive");
	let target = random.nextNumber() * total;
	for (let index = 0; index < weights.size(); index++) {
		target -= weights[index] ?? 0;
		if (target < 0) return index;
	}
	return weights.size() - 1;
}
