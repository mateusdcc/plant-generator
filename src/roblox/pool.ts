/** Factory/reset contract for a bounded reusable Instance pool. @public */
export interface InstancePoolPolicy<T extends Instance> {
	/** Allocates one new Instance when no reusable entry is available. */
	create(): T;
	/** Clears consumer state before an Instance returns to the available pool. */
	reset(instance: T): void;
	/** Optionally customizes final resource destruction. */
	destroy?(instance: T): void;
}

/** Pool counters useful for diagnostics and leak checks. @public */
export interface InstancePoolStatistics {
	readonly created: number;
	readonly available: number;
	readonly inUse: number;
	readonly exhausted: number;
}

/** Bounded generic Roblox Instance pool. @public */
export class InstancePool<T extends Instance> {
	private readonly available = new Array<T>();
	private readonly used = new Array<T>();
	private created = 0;
	private exhausted = 0;

	public constructor(
		private readonly capacity: number,
		private readonly policy: InstancePoolPolicy<T>,
	) {
		assert(capacity > 0, "pool capacity must be positive");
	}

	/** Acquires a reset Instance or allocates within capacity. */
	public acquire(): T | undefined {
		let instance = this.available.pop();
		if (instance === undefined) {
			if (this.created >= this.capacity) {
				this.exhausted++;
				return undefined;
			}
			instance = this.policy.create();
			this.created++;
		}
		this.used.push(instance);
		return instance;
	}

	/** Resets and releases an in-use Instance. */
	public release(instance: T): boolean {
		const index = this.used.indexOf(instance);
		if (index < 0) return false;
		this.used.remove(index);
		this.policy.reset(instance);
		this.available.push(instance);
		return true;
	}

	/** Releases every currently in-use Instance. */
	public releaseAll(): void {
		while (this.used.size() > 0) {
			const instance = this.used[this.used.size() - 1];
			if (instance !== undefined) this.release(instance);
		}
	}

	/** Returns allocation, usage, availability, and exhaustion counters. */
	public statistics(): InstancePoolStatistics {
		return {
			created: this.created,
			available: this.available.size(),
			inUse: this.used.size(),
			exhausted: this.exhausted,
		};
	}

	/** Permanently destroys all used and available Instances. */
	public destroy(): void {
		for (const instance of this.used) (this.policy.destroy ?? ((value: T) => value.Destroy()))(instance);
		for (const instance of this.available) (this.policy.destroy ?? ((value: T) => value.Destroy()))(instance);
		this.used.clear();
		this.available.clear();
		this.created = 0;
	}
}
