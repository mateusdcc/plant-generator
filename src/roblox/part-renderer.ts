import { length3, sub3 } from "../math/vector";
import type { GeneratedOrgan, PlantGenerationResult } from "../runtime/generator";
import type { BranchSegment } from "../topology/branch-graph";
import type { LodLevel } from "./lod";
import { InstancePool, type InstancePoolPolicy } from "./pool";
import { toRobloxVector, type PlantRenderer, type StreamingPlantRenderHandle } from "./renderer";

/** Optional factory for specialized leaf, flower, fruit, or custom organ Parts. @public */
export interface PartOrganFactory {
	/** Return `undefined` to use the renderer's lightweight pooled default. */
	create(organ: GeneratedOrgan): Part | undefined;
}

/** Part renderer configuration; parent is always explicit. @public */
export interface PartPlantRendererOptions {
	readonly parent: Instance;
	readonly name?: string;
	readonly maxInstances?: number;
	readonly anchored?: boolean;
	readonly canCollide?: boolean;
	readonly branchMaterial?: Enum.Material;
	readonly branchColor?: Color3;
	readonly organMaterial?: Enum.Material;
	readonly leafColor?: Color3;
	readonly flowerColor?: Color3;
	readonly organFactory?: PartOrganFactory;
}

class PartPoolPolicy implements InstancePoolPolicy<Part> {
	public create(): Part {
		const part = new Instance("Part");
		part.Shape = Enum.PartType.Cylinder;
		part.CastShadow = true;
		return part;
	}

	public reset(instance: Part): void {
		instance.Parent = undefined;
		instance.Transparency = 0;
		instance.Shape = Enum.PartType.Cylinder;
		instance.Size = new Vector3(1, 1, 1);
		instance.SetAttribute("PlantSegmentId", undefined);
		instance.SetAttribute("PlantOrganId", undefined);
		instance.SetAttribute("PlantOrganKind", undefined);
		instance.SetAttribute("PlantMaterialTag", undefined);
	}
}

interface RenderedSegmentPart {
	readonly kind: "segment";
	readonly part: Part;
	readonly segment: BranchSegment;
	readonly baseLength: number;
}

interface RenderedOrganPart {
	readonly kind: "organ";
	readonly part: Part;
	readonly organ: GeneratedOrgan;
	readonly baseSize: Vector3;
	readonly pooled: boolean;
}

type RenderedPart = RenderedSegmentPart | RenderedOrganPart;

class PartPlantRenderHandle implements StreamingPlantRenderHandle {
	private readonly model: Model;
	private readonly rendered = new Array<RenderedPart>();
	private segmentCursor = 0;
	private organCursor = 0;
	private cancelled = false;
	private destroyed = false;
	private growth = 1;
	private lod: LodLevel = "full";

	public constructor(
		private readonly result: PlantGenerationResult,
		private readonly options: PartPlantRendererOptions,
		private readonly pool: InstancePool<Part>,
	) {
		this.model = new Instance("Model");
		this.model.Name = options.name ?? `Plant_${result.descriptor.seed}`;
		this.model.Parent = options.parent;
	}

	public step(maximumInstances: number): number {
		if (this.cancelled || this.destroyed) return 0;
		let created = 0;
		const limit = math.max(0, math.floor(maximumInstances));
		const maximum = this.options.maxInstances ?? 5_000;
		while (created < limit && !this.isComplete()) {
			if (this.rendered.size() >= maximum) {
				this.cancelled = true;
				break;
			}
			if (this.segmentCursor < this.result.branchGraph.segments.size()) {
				const segment = this.result.branchGraph.segments[this.segmentCursor++];
				if (segment === undefined || !this.includesSegment(segment)) continue;
				const part = this.pool.acquire();
				if (part === undefined) {
					this.cancelled = true;
					break;
				}
				this.configureSegmentPart(part, segment);
				part.Parent = this.model;
				this.rendered.push({
					kind: "segment",
					part,
					segment,
					baseLength: length3(sub3(segment.end, segment.start)),
				});
				created++;
				continue;
			}

			const organ = this.result.organs[this.organCursor++];
			if (organ === undefined || !this.includesOrgans()) continue;
			const custom = this.options.organFactory?.create(organ);
			const pooled = custom === undefined;
			const part = custom ?? this.pool.acquire();
			if (part === undefined) {
				this.cancelled = true;
				break;
			}
			this.configureOrganPart(part, organ, pooled);
			part.Parent = this.model;
			this.rendered.push({ kind: "organ", part, organ, baseSize: part.Size, pooled });
			created++;
		}
		return created;
	}

	private includesSegment(segment: BranchSegment): boolean {
		if (this.lod === "impostor") return segment.parentSegmentId === undefined && segment.id === 0;
		if (this.lod === "low") return segment.branchOrder <= 1 && segment.depth <= 3;
		if (this.lod === "medium") return segment.branchOrder <= 3 && segment.depth <= 8;
		return true;
	}

	private includesOrgans(): boolean {
		return this.lod === "full" || this.lod === "medium";
	}

	private configureSegmentPart(part: Part, segment: BranchSegment): void {
		const start = toRobloxVector(segment.start);
		const finish = toRobloxVector(segment.end);
		const direction = finish.sub(start);
		const length = direction.Magnitude;
		const unitDirection = length > 1e-6 ? direction.Unit : toRobloxVector(segment.frame.heading);
		const midpoint = start.add(finish).div(2);
		const up = toRobloxVector(segment.frame.up);
		part.Shape = Enum.PartType.Cylinder;
		part.Size = new Vector3(
			math.max(length * this.growth, 0.001),
			math.max((segment.radiusStart + segment.radiusEnd) * this.growth, 0.001),
			math.max((segment.radiusStart + segment.radiusEnd) * this.growth, 0.001),
		);
		part.CFrame = CFrame.fromMatrix(midpoint, unitDirection, up);
		part.Anchored = this.options.anchored ?? true;
		part.CanCollide = this.options.canCollide ?? false;
		part.Material = this.options.branchMaterial ?? Enum.Material.SmoothPlastic;
		part.Color = this.options.branchColor ?? new Color3(0.25, 0.14, 0.06);
		part.Transparency = this.growth <= 0 ? 1 : 0;
		part.SetAttribute("PlantSegmentId", segment.id);
		part.SetAttribute("PlantMaterialTag", "branch");
	}

	private configureOrganPart(part: Part, organ: GeneratedOrgan, useDefaults: boolean): void {
		const position = toRobloxVector(organ.transform.position);
		const heading = toRobloxVector(organ.transform.frame.heading);
		const up = toRobloxVector(organ.transform.frame.up);
		if (useDefaults) {
			const flower = organ.kind === "flower";
			part.Shape = flower ? Enum.PartType.Ball : Enum.PartType.Block;
			part.Size = flower ? new Vector3(0.35, 0.35, 0.35) : new Vector3(0.28, 0.06, 0.55);
			part.Material = this.options.organMaterial ?? Enum.Material.SmoothPlastic;
			part.Color = flower
				? (this.options.flowerColor ?? new Color3(0.95, 0.55, 0.72))
				: (this.options.leafColor ?? new Color3(0.2, 0.55, 0.16));
		}
		part.CFrame = CFrame.lookAt(position, position.add(heading), up);
		part.Anchored = this.options.anchored ?? true;
		part.CanCollide = this.options.canCollide ?? false;
		part.Transparency = this.growth <= 0 ? 1 : 0;
		part.SetAttribute("PlantOrganId", organ.id);
		part.SetAttribute("PlantOrganKind", organ.kind);
		part.SetAttribute("PlantMaterialTag", organ.kind);
	}

	public isComplete(): boolean {
		return (
			(this.segmentCursor >= this.result.branchGraph.segments.size() &&
				this.organCursor >= this.result.organs.size()) ||
			this.cancelled
		);
	}

	public setGrowth(growth: number): void {
		this.growth = math.clamp(growth, 0, 1);
		for (const entry of this.rendered) {
			if (entry.kind === "segment") {
				entry.part.Size = new Vector3(
					math.max(entry.baseLength * this.growth, 0.001),
					math.max((entry.segment.radiusStart + entry.segment.radiusEnd) * this.growth, 0.001),
					math.max((entry.segment.radiusStart + entry.segment.radiusEnd) * this.growth, 0.001),
				);
			} else {
				entry.part.Size = new Vector3(
					math.max(entry.baseSize.X * this.growth, 0.001),
					math.max(entry.baseSize.Y * this.growth, 0.001),
					math.max(entry.baseSize.Z * this.growth, 0.001),
				);
			}
			this.updateVisibility(entry);
		}
	}

	public setTime(time: number): void {
		const duration = math.max(1, this.result.branchGraph.segments.size());
		this.setGrowth(time / duration);
	}

	public setLod(level: LodLevel): void {
		this.lod = level;
		for (const entry of this.rendered) this.updateVisibility(entry);
	}

	private updateVisibility(entry: RenderedPart): void {
		const total = entry.kind === "segment" ? this.result.branchGraph.segments.size() : this.result.organs.size();
		const id = entry.kind === "segment" ? entry.segment.id : entry.organ.id;
		const included = entry.kind === "segment" ? this.includesSegment(entry.segment) : this.includesOrgans();
		entry.part.Transparency = this.growth > 0 && this.growth * math.max(1, total) >= id + 1 && included ? 0 : 1;
	}

	public updateTransform(transform: CFrame): void {
		this.model.PivotTo(transform);
	}

	public updateMaterialTag(tag: string, material: Enum.Material, color?: Color3): void {
		for (const entry of this.rendered) {
			if (entry.part.GetAttribute("PlantMaterialTag") !== tag) continue;
			entry.part.Material = material;
			if (color !== undefined) entry.part.Color = color;
		}
	}

	public getStatistics(): Readonly<Record<string, number>> {
		const pool = this.pool.statistics();
		return {
			renderedInstances: this.rendered.size(),
			pendingSegments: math.max(0, this.result.branchGraph.segments.size() - this.segmentCursor),
			pendingOrgans: math.max(0, this.result.organs.size() - this.organCursor),
			poolCreated: pool.created,
			poolExhausted: pool.exhausted,
		};
	}

	public cancel(): void {
		this.cancelled = true;
	}

	public destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		for (const entry of this.rendered) {
			if (entry.kind === "organ" && !entry.pooled) entry.part.Destroy();
			else this.pool.release(entry.part);
		}
		this.rendered.clear();
		this.model.Destroy();
	}
}

/** Production Part adapter using a bounded reusable pool and batched rendering. @public */
export class PartPlantRenderer implements PlantRenderer<StreamingPlantRenderHandle> {
	private readonly pool: InstancePool<Part>;

	public constructor(private readonly options: PartPlantRendererOptions) {
		this.pool = new InstancePool(options.maxInstances ?? 5_000, new PartPoolPolicy());
	}

	/** Renders all currently selected topology in bounded internal batches. */
	public render(result: PlantGenerationResult): StreamingPlantRenderHandle {
		const handle = new PartPlantRenderHandle(result, this.options, this.pool);
		while (!handle.isComplete()) handle.step(250);
		return handle;
	}

	/** Creates a handle that the caller can advance over multiple frames. */
	public beginRender(result: PlantGenerationResult): StreamingPlantRenderHandle {
		return new PartPlantRenderHandle(result, this.options, this.pool);
	}

	/** Destroys every pooled Instance retained by this renderer. */
	public destroy(): void {
		this.pool.destroy();
	}
}
