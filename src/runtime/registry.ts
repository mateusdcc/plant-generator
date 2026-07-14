import type { GrowthFunction } from "../animation/growth";
import type { ProductionPredicate, ProductionSuccessor } from "../core/grammar";
import type { MeshData } from "../geometry/mesh";
import type { OrganAttachment, BranchGraph } from "../topology/branch-graph";

/** Named behavior registry used instead of serializing callbacks. @public */
export class BehaviorRegistry<T> {
	private readonly entries: Record<string, T> = {};

	/** Adds a value and rejects duplicate or empty IDs. */
	public register(id: string, value: T): void {
		assert(id.size() > 0, "registry ids must not be empty");
		assert(this.entries[id] === undefined, `registry id ${id} is already registered`);
		this.entries[id] = value;
	}

	/** Adds or replaces the value for a nonempty ID. */
	public replace(id: string, value: T): void {
		assert(id.size() > 0, "registry ids must not be empty");
		this.entries[id] = value;
	}

	/** Resolves a registered value without throwing for an unknown ID. */
	public resolve(id: string): T | undefined {
		return this.entries[id];
	}

	/** Reports whether an ID is registered. */
	public has(id: string): boolean {
		return this.entries[id] !== undefined;
	}

	/** Returns registered IDs in deterministic lexical order. */
	public ids(): readonly string[] {
		const result = new Array<string>();
		for (const [id] of pairs(this.entries)) result.push(id);
		sortStrings(result);
		return result;
	}

	/** Removes an ID and reports whether it existed. */
	public unregister(id: string): boolean {
		if (this.entries[id] === undefined) return false;
		this.entries[id] = undefined as never;
		return true;
	}
}

function sortStrings(values: string[]): void {
	for (let index = 1; index < values.size(); index++) {
		const value = values[index];
		if (value === undefined) continue;
		let cursor = index - 1;
		while (cursor >= 0 && (values[cursor] ?? "") > value) {
			values[cursor + 1] = values[cursor] ?? "";
			cursor--;
		}
		values[cursor + 1] = value;
	}
}

/** Creates branch geometry from renderer-neutral topology. @public */
export interface BranchGeometryFactory {
	/** Builds mesh data for a complete branch graph. */
	create(graph: BranchGraph): MeshData;
}

/** Backward-compatible concise name for a branch geometry factory. @public */
export type GeometryFactory = BranchGeometryFactory;

/** Organ factory extension. @public */
export interface OrganFactory {
	/** Builds optional mesh data for one topological organ attachment. */
	create(attachment: OrganAttachment, growth: number): MeshData | undefined;
}

/** All serialization-safe extension points resolved by stable IDs. @public */
export interface BehaviorRegistries {
	readonly productionOperations: BehaviorRegistry<ProductionSuccessor>;
	readonly predicates: BehaviorRegistry<ProductionPredicate>;
	readonly growthFunctions: BehaviorRegistry<GrowthFunction>;
	readonly geometryFactories: BehaviorRegistry<GeometryFactory>;
	readonly organFactories: BehaviorRegistry<OrganFactory>;
}

/** Creates isolated empty registries; no accidental global mutable state. @public */
export function createBehaviorRegistries(): BehaviorRegistries {
	return {
		productionOperations: new BehaviorRegistry<ProductionSuccessor>(),
		predicates: new BehaviorRegistry<ProductionPredicate>(),
		growthFunctions: new BehaviorRegistry<GrowthFunction>(),
		geometryFactories: new BehaviorRegistry<GeometryFactory>(),
		organFactories: new BehaviorRegistry<OrganFactory>(),
	};
}
