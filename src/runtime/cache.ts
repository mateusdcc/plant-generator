/** Minimal cache boundary for consumer-provided storage. @public */
export interface GenerationCache<T> {
	/** Resolves a value and updates any implementation-specific recency state. */
	get(key: string): T | undefined;
	/** Inserts or replaces a value. */
	set(key: string, value: T): void;
	/** Removes a value and reports whether it existed. */
	delete(key: string): boolean;
	/** Removes every cached value. */
	clear(): void;
	/** Returns the current entry count. */
	getSize(): number;
}

/** Bounded least-recently-used in-memory cache. @public */
export class LruGenerationCache<T> implements GenerationCache<T> {
	private readonly entries: Record<string, { value: T; access: number }> = {};
	private access = 0;
	private size = 0;

	public constructor(private readonly capacity: number) {
		assert(capacity > 0, "cache capacity must be positive");
	}

	/** Resolves and marks an entry as most recently used. */
	public get(key: string): T | undefined {
		const entry = this.entries[key];
		if (entry === undefined) return undefined;
		entry.access = ++this.access;
		return entry.value;
	}

	/** Inserts or replaces an entry, evicting the least-recently-used item when full. */
	public set(key: string, value: T): void {
		const existing = this.entries[key];
		if (existing !== undefined) {
			existing.value = value;
			existing.access = ++this.access;
			return;
		}
		if (this.size >= this.capacity) {
			let oldestKey: string | undefined;
			let oldestAccess = math.huge;
			for (const [candidateKey, entry] of pairs(this.entries)) {
				if (entry.access < oldestAccess) {
					oldestAccess = entry.access;
					oldestKey = candidateKey;
				}
			}
			if (oldestKey !== undefined) this.delete(oldestKey);
		}
		this.entries[key] = { value, access: ++this.access };
		this.size++;
	}

	/** Removes an entry and reports whether it existed. */
	public delete(key: string): boolean {
		if (this.entries[key] === undefined) return false;
		this.entries[key] = undefined as never;
		this.size--;
		return true;
	}

	/** Removes every entry without changing capacity. */
	public clear(): void {
		for (const [key] of pairs(this.entries)) this.entries[key] = undefined as never;
		this.size = 0;
	}

	/** Returns the current entry count. */
	public getSize(): number {
		return this.size;
	}
}
