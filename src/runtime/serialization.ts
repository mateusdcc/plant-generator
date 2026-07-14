import { Diagnostics, type Diagnostic } from "../core/diagnostics";
import type { StructuredParameter, SymbolParameter } from "../core/symbols";
import type { ModelSpecification } from "./specification";

/** Compact network-reconstructable plant descriptor. @public */
export interface PlantDescriptor {
	readonly schemaVersion: 1;
	readonly modelId: string;
	readonly modelVersion?: string;
	readonly modelHash: string;
	readonly seed: number;
	readonly iterations: number;
	readonly time: number;
	readonly parameterOverrides: Readonly<Record<string, SymbolParameter>>;
	readonly mutations: StructuredParameter;
}

/** Serialized descriptor envelope with explicit kind/version. @public */
export interface SerializedPlantDescriptor {
	readonly kind: "plant-descriptor";
	readonly version: 1;
	readonly value: PlantDescriptor;
}

/** Non-throwing deserialization result. @public */
export interface DescriptorReadResult {
	readonly value?: PlantDescriptor;
	readonly diagnostics: readonly Diagnostic[];
}

/** Versioned plain-data serializer; no Roblox service dependency. @public */
export class PlantSerializer {
	/** Wraps a descriptor in an explicit versioned envelope. */
	public static serialize(descriptor: PlantDescriptor): SerializedPlantDescriptor {
		return { kind: "plant-descriptor", version: 1, value: descriptor };
	}

	/** Validates an envelope and optional server-owned model allow-list. */
	public static deserialize(
		input: SerializedPlantDescriptor,
		allowedModelIds?: readonly string[],
	): DescriptorReadResult {
		const diagnostics = new Diagnostics();
		if (input.kind !== "plant-descriptor" || input.version !== 1 || input.value.schemaVersion !== 1) {
			diagnostics.error("UNSUPPORTED_SCHEMA_VERSION", "Unsupported or corrupt plant descriptor envelope.");
			return { diagnostics: diagnostics.all() };
		}
		if (allowedModelIds !== undefined) {
			let allowed = false;
			for (const id of allowedModelIds) if (id === input.value.modelId) allowed = true;
			if (!allowed) {
				diagnostics.error("INVALID_PARAMETER", `Model ${input.value.modelId} is not allow-listed.`);
				return { diagnostics: diagnostics.all() };
			}
		}
		return { value: input.value, diagnostics: diagnostics.all() };
	}

	/** Model specs are already plain data; this method enforces the explicit API boundary. @public */
	public static serializeModel(specification: ModelSpecification): ModelSpecification {
		return specification;
	}
}
