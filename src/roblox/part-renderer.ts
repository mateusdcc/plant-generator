import {
	createStructuralGrowthSchedule,
	elongateSegment,
	evaluateStructuralGrowthSpan,
	type StructuralGrowthSchedule,
} from "../animation/structural-growth";
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
		for (const child of instance.GetChildren()) child.Destroy();
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
	localGrowth: number;
}

interface RenderedOrganPart {
	readonly kind: "organ";
	readonly part: Part;
	readonly organ: GeneratedOrgan;
	readonly baseSize: Vector3;
	readonly pooled: boolean;
	localGrowth: number;
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
	private readonly growthSchedule: StructuralGrowthSchedule;
	private rootTransform = CFrame.identity;

	public constructor(
		private readonly result: PlantGenerationResult,
		private readonly options: PartPlantRendererOptions,
		private readonly pool: InstancePool<Part>,
	) {
		this.model = new Instance("Model");
		this.model.Name = options.name ?? `Plant_${result.descriptor.seed}`;
		// Pin the model pivot to the botanical origin before adding geometry. Without
		// an explicit WorldPivot, Roblox derives it from the changing bounding box.
		this.model.WorldPivot = CFrame.identity;
		this.model.Parent = options.parent;
		this.growthSchedule = createStructuralGrowthSchedule(result.branchGraph, result.organs);
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
				const entry: RenderedSegmentPart = {
					kind: "segment",
					part,
					segment,
					localGrowth: 0,
				};
				this.updatePresentation(entry);
				part.Parent = this.model;
				this.rendered.push(entry);
				created++;
				continue;
			}

			const organ = this.result.organs[this.organCursor++];
			if (organ === undefined || !this.includesOrgan(organ)) continue;
			const custom = this.options.organFactory?.create(organ);
			const pooled = custom === undefined;
			const part = custom ?? this.pool.acquire();
			if (part === undefined) {
				this.cancelled = true;
				break;
			}
			this.configureOrganPart(part, organ, pooled);
			const entry: RenderedOrganPart = {
				kind: "organ",
				part,
				organ,
				baseSize: part.Size,
				pooled,
				localGrowth: 0,
			};
			this.updatePresentation(entry);
			part.Parent = this.model;
			this.rendered.push(entry);
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

	private includesOrgan(organ: GeneratedOrgan): boolean {
		if (this.lod !== "full" && this.lod !== "medium") return false;
		const host = this.result.branchGraph.segments[organ.segmentId];
		return host !== undefined && this.includesSegment(host);
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
			math.max(length, 0.001),
			math.max(segment.radiusStart + segment.radiusEnd, 0.001),
			math.max(segment.radiusStart + segment.radiusEnd, 0.001),
		);
		part.CFrame = this.rootTransform.ToWorldSpace(CFrame.fromMatrix(midpoint, unitDirection, up));
		part.Anchored = this.options.anchored ?? true;
		part.CanCollide = this.options.canCollide ?? false;
		part.Material = this.options.branchMaterial ?? Enum.Material.Wood;
		part.Color = this.options.branchColor ?? new Color3(0.25, 0.14, 0.06);
		part.Transparency = 1;
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
			part.Size = flower ? new Vector3(0.35, 0.35, 0.35) : new Vector3(0.3, 0.08, 0.58);
			if (!flower) {
				const mesh = new Instance("SpecialMesh");
				mesh.MeshType = Enum.MeshType.Sphere;
				mesh.Parent = part;
			}
			part.Material = this.options.organMaterial ?? (flower ? Enum.Material.Fabric : Enum.Material.LeafyGrass);
			part.Color = flower
				? (this.options.flowerColor ?? new Color3(0.95, 0.55, 0.72))
				: (this.options.leafColor ?? new Color3(0.2, 0.55, 0.16));
		}
		part.CFrame = this.rootTransform.ToWorldSpace(CFrame.lookAt(position, position.add(heading), up));
		part.Anchored = this.options.anchored ?? true;
		part.CanCollide = this.options.canCollide ?? false;
		part.Transparency = 1;
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
		for (const entry of this.rendered) this.updatePresentation(entry);
	}

	public setTime(time: number): void {
		this.setGrowth(time);
	}

	public setLod(level: LodLevel): void {
		this.lod = level;
		for (const entry of this.rendered) this.updateVisibility(entry);
	}

	private updateVisibility(entry: RenderedPart): void {
		const included =
			entry.kind === "segment" ? this.includesSegment(entry.segment) : this.includesOrgan(entry.organ);
		entry.part.Transparency = entry.localGrowth > 0 && included ? 0 : 1;
	}

	private updatePresentation(entry: RenderedPart): void {
		const span =
			entry.kind === "segment"
				? this.growthSchedule.segmentSpans[entry.segment.id]
				: this.growthSchedule.organSpans[entry.organ.id];
		entry.localGrowth = span === undefined ? this.growth : evaluateStructuralGrowthSpan(span, this.growth);
		if (entry.kind === "segment") {
			const geometry = elongateSegment(entry.segment, entry.localGrowth);
			const start = toRobloxVector(entry.segment.start);
			const finish = toRobloxVector(entry.segment.end);
			const direction = finish.sub(start);
			const unitDirection =
				direction.Magnitude > 1e-6 ? direction.Unit : toRobloxVector(entry.segment.frame.heading);
			const up = toRobloxVector(entry.segment.frame.up);
			const diameter = (entry.segment.radiusStart + entry.segment.radiusEnd) * entry.localGrowth;
			entry.part.Size = new Vector3(
				math.max(geometry.length, 0.001),
				math.max(diameter, 0.001),
				math.max(diameter, 0.001),
			);
			entry.part.CFrame = this.rootTransform.ToWorldSpace(
				CFrame.fromMatrix(toRobloxVector(geometry.center), unitDirection, up),
			);
		} else {
			entry.part.Size = new Vector3(
				math.max(entry.baseSize.X * entry.localGrowth, 0.001),
				math.max(entry.baseSize.Y * entry.localGrowth, 0.001),
				math.max(entry.baseSize.Z * entry.localGrowth, 0.001),
			);
		}
		this.updateVisibility(entry);
	}

	public updateTransform(transform: CFrame): void {
		this.model.PivotTo(transform);
		this.rootTransform = transform;
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
