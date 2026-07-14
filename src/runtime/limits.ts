/** Explicit count and work limits for bounded generation. @public */
export interface GenerationLimits {
	readonly maxIterations: number;
	readonly maxSymbols: number;
	readonly maxBranchDepth: number;
	readonly maxStackDepth: number;
	readonly maxSegments: number;
	readonly maxOrgans: number;
	readonly maxVertices: number;
	readonly maxTriangles: number;
	readonly maxWorkUnits: number;
	readonly maxRenderedInstances: number;
}

/** Conservative defaults suitable for interactive generation. @public */
export const DEFAULT_LIMITS: GenerationLimits = {
	maxIterations: 12,
	maxSymbols: 50_000,
	maxBranchDepth: 64,
	maxStackDepth: 128,
	maxSegments: 10_000,
	maxOrgans: 10_000,
	maxVertices: 200_000,
	maxTriangles: 300_000,
	maxWorkUnits: 1_000_000,
	maxRenderedInstances: 5_000,
};

/** Mutable cancellation boundary shared by long-running operations. @public */
export interface CancellationToken {
	/** Reports whether cooperative work should stop at its next safe boundary. */
	isCancellationRequested(): boolean;
}

/** Cancellation source controlled by a caller. @public */
export class CancellationSource implements CancellationToken {
	private cancelled = false;

	/** Permanently requests cancellation. */
	public cancel(): void {
		this.cancelled = true;
	}

	/** Reports whether cancellation has been requested. */
	public isCancellationRequested(): boolean {
		return this.cancelled;
	}
}

class NeverCancelledToken implements CancellationToken {
	public isCancellationRequested(): boolean {
		return false;
	}
}

/** Token that never cancels and allocates no per-step objects. @public */
export const NEVER_CANCELLED: CancellationToken = new NeverCancelledToken();

/** Tracks deterministic work units independent of wall-clock performance. @public */
export class WorkBudget {
	private consumed = 0;

	public constructor(public readonly limit: number) {
		assert(limit >= 0, "work budget must be nonnegative");
	}

	/** Consumes units only when they fit within the configured bound. */
	public tryConsume(units = 1): boolean {
		if (units < 0 || this.consumed + units > this.limit) return false;
		this.consumed += units;
		return true;
	}

	/** Returns consumed deterministic work units. */
	public used(): number {
		return this.consumed;
	}

	/** Returns work units available before the limit is reached. */
	public remaining(): number {
		return math.max(0, this.limit - this.consumed);
	}
}
