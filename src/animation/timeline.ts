import type { ModuleSymbol } from "../core/symbols";

/** Symbol with explicit lifetime for timed DOL evaluation. @public */
export interface TimedSymbol {
	readonly symbol: ModuleSymbol;
	readonly birthTime: number;
	readonly lifespan?: number;
}

/** Discrete topology event on a plant timeline. @public */
export interface TimelineEvent {
	readonly time: number;
	readonly kind: "birth" | "death" | "rewrite";
	readonly symbolIndex: number;
}

/** Symbol plus absolute and normalized age at an evaluation time. @public */
export interface EvaluatedTimedSymbol {
	readonly symbol: ModuleSymbol;
	readonly age: number;
	readonly normalizedAge: number;
}

/** Evaluates a timed word directly at arbitrary absolute time. @public */
export function evaluateTimedWord(word: readonly TimedSymbol[], time: number): readonly EvaluatedTimedSymbol[] {
	const result = new Array<EvaluatedTimedSymbol>();
	for (const value of word) {
		if (time < value.birthTime) continue;
		const age = time - value.birthTime;
		if (value.lifespan !== undefined && age >= value.lifespan) continue;
		result.push({
			symbol: value.symbol,
			age,
			normalizedAge:
				value.lifespan === undefined || value.lifespan <= 0 ? 1 : math.clamp(age / value.lifespan, 0, 1),
		});
	}
	return result;
}

/** Absolute-time timeline supporting forward playback and backward scrubbing. @public */
export class PlantTimeline {
	private time = 0;

	public constructor(private readonly word: readonly TimedSymbol[]) {}

	/** Scrubs to an absolute time and returns the symbols alive at that instant. */
	public evaluate(time: number): readonly EvaluatedTimedSymbol[] {
		this.time = time;
		return evaluateTimedWord(this.word, time);
	}

	/** Returns the most recently evaluated absolute time. */
	public currentTime(): number {
		return this.time;
	}

	/** Enumerates birth and death events in a closed time interval. */
	public events(startTime = -math.huge, endTime = math.huge): readonly TimelineEvent[] {
		const events = new Array<TimelineEvent>();
		for (let index = 0; index < this.word.size(); index++) {
			const value = this.word[index];
			if (value === undefined) continue;
			if (value.birthTime >= startTime && value.birthTime <= endTime)
				events.push({ time: value.birthTime, kind: "birth", symbolIndex: index });
			if (value.lifespan !== undefined) {
				const deathTime = value.birthTime + value.lifespan;
				if (deathTime >= startTime && deathTime <= endTime)
					events.push({ time: deathTime, kind: "death", symbolIndex: index });
			}
		}
		for (let index = 1; index < events.size(); index++) {
			const value = events[index];
			if (value === undefined) continue;
			let cursor = index - 1;
			while (cursor >= 0) {
				const previous = events[cursor];
				if (
					previous === undefined ||
					previous.time < value.time ||
					(previous.time === value.time && previous.symbolIndex < value.symbolIndex)
				)
					break;
				events[cursor + 1] = previous;
				cursor--;
			}
			events[cursor + 1] = value;
		}
		return events;
	}
}
