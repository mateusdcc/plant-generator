/** Named growth function that can be registered and serialized by ID. @public */
export interface GrowthFunction {
	readonly id: string;
	/** Evaluates the curve for a normalized age, normally in the inclusive range 0–1. */
	evaluate(normalizedAge: number): number;
}

class CallbackGrowthFunction implements GrowthFunction {
	public constructor(
		public readonly id: string,
		private readonly callback: (age: number) => number,
	) {}

	public evaluate(normalizedAge: number): number {
		return this.callback(math.clamp(normalizedAge, 0, 1));
	}
}

/** Built-in growth function identifier. @public */
export type BuiltInGrowthKind =
	| "constant"
	| "linear"
	| "inverse-linear"
	| "smoothstep"
	| "smootherstep"
	| "exponential"
	| "ease-in"
	| "ease-out"
	| "ease-in-out"
	| "logistic";

/** Creates a bounded built-in growth function. @public */
export function createGrowthFunction(kind: BuiltInGrowthKind, parameter = 5): GrowthFunction {
	return new CallbackGrowthFunction(kind, (age) => {
		switch (kind) {
			case "constant":
				return 1;
			case "linear":
				return age;
			case "inverse-linear":
				return 1 - age;
			case "smoothstep":
				return age * age * (3 - 2 * age);
			case "smootherstep":
				return age * age * age * (age * (age * 6 - 15) + 10);
			case "exponential": {
				const denominator = math.exp(parameter) - 1;
				return math.abs(denominator) < 1e-9 ? age : (math.exp(parameter * age) - 1) / denominator;
			}
			case "ease-in":
				return age * age;
			case "ease-out":
				return 1 - (1 - age) * (1 - age);
			case "ease-in-out":
				return age < 0.5 ? 2 * age * age : 1 - math.pow(-2 * age + 2, 2) / 2;
			case "logistic": {
				const raw = (x: number) => 1 / (1 + math.exp(-parameter * (x - 0.5)));
				const low = raw(0);
				const high = raw(1);
				return (raw(age) - low) / (high - low);
			}
		}
	});
}

/** Keyframe for piecewise-linear growth. @public */
export interface GrowthKeyframe {
	readonly time: number;
	readonly value: number;
}

/** Creates a validated, clamped keyframed growth curve. @public */
export function createKeyframedGrowth(id: string, keyframes: readonly GrowthKeyframe[]): GrowthFunction {
	assert(keyframes.size() >= 1, "at least one keyframe is required");
	for (let index = 1; index < keyframes.size(); index++) {
		assert(
			(keyframes[index]?.time ?? 0) > (keyframes[index - 1]?.time ?? 0),
			"keyframe times must be strictly increasing",
		);
	}
	return new CallbackGrowthFunction(id, (age) => {
		const first = keyframes[0];
		const last = keyframes[keyframes.size() - 1];
		if (first === undefined || last === undefined) return 0;
		if (age <= first.time) return first.value;
		if (age >= last.time) return last.value;
		for (let index = 1; index < keyframes.size(); index++) {
			const right = keyframes[index];
			const left = keyframes[index - 1];
			if (right !== undefined && left !== undefined && age <= right.time) {
				const alpha = (age - left.time) / (right.time - left.time);
				return left.value + (right.value - left.value) * alpha;
			}
		}
		return last.value;
	});
}

/** Creates a piecewise curve from adjacent functions and normalized boundaries. @public */
export function createPiecewiseGrowth(
	id: string,
	pieces: readonly { readonly start: number; readonly finish: number; readonly function: GrowthFunction }[],
): GrowthFunction {
	assert(pieces.size() > 0, "at least one piece is required");
	return new CallbackGrowthFunction(id, (age) => {
		for (const piece of pieces) {
			if (age >= piece.start && age <= piece.finish) {
				const span = piece.finish - piece.start;
				return piece.function.evaluate(span <= 0 ? 1 : (age - piece.start) / span);
			}
		}
		return age < (pieces[0]?.start ?? 0) ? 0 : 1;
	});
}

/** Independent growth channels consumed by renderers. @public */
export interface GrowthChannels {
	readonly length: number;
	readonly radius: number;
	readonly curvature: number;
	readonly leafOpening: number;
	readonly flowerOpening: number;
	readonly organScale: number;
	readonly visibility: number;
	readonly tropismStrength: number;
	readonly metadata: Readonly<Record<string, number | string | boolean>>;
}

/** Maps absolute time to frame-rate-independent channels. @public */
export class GrowthHandle {
	public constructor(
		private readonly birthTime: number,
		private readonly duration: number,
		private readonly channels: Partial<Record<Exclude<keyof GrowthChannels, "metadata">, GrowthFunction>>,
		private readonly metadata: Readonly<Record<string, number | string | boolean>> = {},
	) {}

	/** Evaluates every configured channel at an absolute time. */
	public evaluate(time: number): GrowthChannels {
		const age = this.duration <= 0 ? 1 : math.clamp((time - this.birthTime) / this.duration, 0, 1);
		const linear = createGrowthFunction("linear");
		return {
			length: (this.channels.length ?? linear).evaluate(age),
			radius: (this.channels.radius ?? linear).evaluate(age),
			curvature: (this.channels.curvature ?? linear).evaluate(age),
			leafOpening: (this.channels.leafOpening ?? linear).evaluate(age),
			flowerOpening: (this.channels.flowerOpening ?? linear).evaluate(age),
			organScale: (this.channels.organScale ?? linear).evaluate(age),
			visibility: (this.channels.visibility ?? createGrowthFunction("constant")).evaluate(age),
			tropismStrength: (this.channels.tropismStrength ?? linear).evaluate(age),
			metadata: this.metadata,
		};
	}
}
