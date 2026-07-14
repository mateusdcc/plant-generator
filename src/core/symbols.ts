import type { Vec2, Vec3 } from "../math/vector";

/** String or numeric identifier used by an alphabet. @public */
export type SymbolId = string | number;

/** Recursive structured parameter value supported by symbols. @public */
export interface StructuredParameter {
	readonly [key: string]: SymbolParameter;
}

/** Parameter value that remains plain data and serialization-safe. @public */
export type SymbolParameter =
	number | boolean | string | Vec2 | Vec3 | readonly SymbolParameter[] | StructuredParameter;

/** Optional provenance recorded only when tracing is enabled. @public */
export interface SymbolTrace {
	readonly generation: number;
	readonly sourceIndex: number;
	readonly productionId?: string;
}

/** Immutable module in an L-system word. @public */
export interface ModuleSymbol {
	readonly id: SymbolId;
	readonly parameters: readonly SymbolParameter[];
	readonly birthTime?: number;
	readonly trace?: SymbolTrace;
}

/** Creates an immutable-by-convention symbol value. @public */
export function symbol(id: SymbolId, ...parameters: readonly SymbolParameter[]): ModuleSymbol {
	return { id, parameters };
}

/** Efficient chunk-buffer word used during parallel derivation. @public */
export class SymbolWord {
	private readonly chunks = new Array<readonly ModuleSymbol[]>();
	private count = 0;

	public constructor(initial?: readonly ModuleSymbol[]) {
		if (initial !== undefined && initial.size() > 0) this.appendChunk(initial);
	}

	/** Appends one module as a single-element chunk. */
	public append(value: ModuleSymbol): void {
		this.chunks.push([value]);
		this.count++;
	}

	/** Appends a successor chunk without flattening existing chunks. */
	public appendChunk(values: readonly ModuleSymbol[]): void {
		if (values.size() === 0) return;
		this.chunks.push(values);
		this.count += values.size();
	}

	/** Returns the total number of modules across all chunks. */
	public size(): number {
		return this.count;
	}

	/** Materializes the chunks as a flat, insertion-ordered word. */
	public toArray(): readonly ModuleSymbol[] {
		const values = new Array<ModuleSymbol>();
		for (const chunk of this.chunks) for (const value of chunk) values.push(value);
		return values;
	}
}

/** Counts symbols by stable stringified identifier. @public */
export function countSymbols(word: readonly ModuleSymbol[]): Readonly<Record<string, number>> {
	const counts: Record<string, number> = {};
	for (const value of word) {
		const key = `${value.id}`;
		counts[key] = (counts[key] ?? 0) + 1;
	}
	return counts;
}
