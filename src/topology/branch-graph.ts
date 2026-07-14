import { Diagnostics, type Diagnostic } from "../core/diagnostics";
import {
	IDENTITY_FRAME,
	add3,
	isFinite3,
	length3,
	scale3,
	sub3,
	type Frame3,
	type Transform3,
	type Vec3,
	vec3,
} from "../math/vector";
import type { StructuredParameter } from "../core/symbols";

/** Axis classification in a plant topology. @public */
export interface PlantAxis {
	readonly id: number;
	readonly parentAxisId?: number;
	readonly order: number;
	readonly segmentIds: readonly number[];
}

/** Point shared by one or more branch segments. @public */
export interface BranchNode {
	readonly id: number;
	readonly position: Vec3;
	readonly incomingSegmentId?: number;
	readonly outgoingSegmentIds: readonly number[];
	readonly birthTime: number;
	readonly deathTime?: number;
}

/** Tapered renderer-independent branch segment. @public */
export interface BranchSegment {
	readonly id: number;
	readonly parentSegmentId?: number;
	readonly axisId: number;
	readonly startNodeId: number;
	readonly endNodeId: number;
	readonly start: Vec3;
	readonly end: Vec3;
	readonly frame: Frame3;
	readonly radiusStart: number;
	readonly radiusEnd: number;
	readonly branchOrder: number;
	readonly depth: number;
	readonly birthTime: number;
	readonly deathTime?: number;
	readonly tags: readonly string[];
	readonly metadata: StructuredParameter;
}

/** Developmental bud attached to a node or segment. @public */
export interface Bud {
	readonly id: number;
	readonly nodeId: number;
	readonly kind: "apical" | "lateral" | "flower";
	readonly state: "dormant" | "active" | "dead" | "converted";
	readonly birthTime: number;
	readonly activationTime?: number;
	readonly deathTime?: number;
	readonly resource: number;
}

/** Generic attachment socket for leaves, flowers, fruit, or custom organs. @public */
export interface OrganAttachment {
	readonly id: number;
	readonly nodeId: number;
	readonly segmentId?: number;
	readonly kind: string;
	readonly transform: Transform3;
	readonly birthTime: number;
	readonly deathTime?: number;
	readonly metadata: StructuredParameter;
}

/** Axis-aligned bounds. @public */
export interface Bounds3 {
	readonly min: Vec3;
	readonly max: Vec3;
}

/** Complete renderer-independent plant topology. @public */
export interface BranchGraph {
	readonly nodes: readonly BranchNode[];
	readonly segments: readonly BranchSegment[];
	readonly axes: readonly PlantAxis[];
	readonly buds: readonly Bud[];
	readonly attachments: readonly OrganAttachment[];
	readonly bounds: Bounds3;
}

/** Returns empty plant topology. @public */
export function emptyBranchGraph(): BranchGraph {
	return {
		nodes: [],
		segments: [],
		axes: [],
		buds: [],
		attachments: [],
		bounds: { min: vec3(0, 0, 0), max: vec3(0, 0, 0) },
	};
}

/** Computes bounds from segment endpoints and organ positions. @public */
export function computeGraphBounds(
	segments: readonly BranchSegment[],
	attachments: readonly OrganAttachment[] = [],
): Bounds3 {
	if (segments.size() === 0 && attachments.size() === 0) return emptyBranchGraph().bounds;
	let min = vec3(math.huge, math.huge, math.huge);
	let max = vec3(-math.huge, -math.huge, -math.huge);
	const include = (point: Vec3) => {
		min = vec3(math.min(min.x, point.x), math.min(min.y, point.y), math.min(min.z, point.z));
		max = vec3(math.max(max.x, point.x), math.max(max.y, point.y), math.max(max.z, point.z));
	};
	for (const segment of segments) {
		include(segment.start);
		include(segment.end);
	}
	for (const attachment of attachments) include(attachment.transform.position);
	return { min, max };
}

/** Iterative depth-first segment traversal. @public */
export function depthFirstSegments(graph: BranchGraph): readonly BranchSegment[] {
	const children = buildSegmentChildren(graph);
	const result = new Array<BranchSegment>();
	const stack = new Array<number>();
	for (let index = graph.segments.size() - 1; index >= 0; index--) {
		if (graph.segments[index]?.parentSegmentId === undefined) stack.push(index);
	}
	while (stack.size() > 0) {
		const id = stack.pop();
		if (id === undefined) continue;
		const segment = graph.segments[id];
		if (segment === undefined) continue;
		result.push(segment);
		const childIds = children[id] ?? [];
		for (let index = childIds.size() - 1; index >= 0; index--) {
			const childId = childIds[index];
			if (childId !== undefined) stack.push(childId);
		}
	}
	return result;
}

/** Iterative breadth-first segment traversal. @public */
export function breadthFirstSegments(graph: BranchGraph): readonly BranchSegment[] {
	const children = buildSegmentChildren(graph);
	const result = new Array<BranchSegment>();
	const queue = new Array<number>();
	for (const segment of graph.segments) if (segment.parentSegmentId === undefined) queue.push(segment.id);
	let cursor = 0;
	while (cursor < queue.size()) {
		const id = queue[cursor++];
		if (id === undefined) continue;
		const segment = graph.segments[id];
		if (segment === undefined) continue;
		result.push(segment);
		for (const child of children[id] ?? []) queue.push(child);
	}
	return result;
}

function buildSegmentChildren(graph: BranchGraph): Readonly<Record<number, readonly number[]>> {
	const children: Record<number, number[]> = {};
	for (const segment of graph.segments) {
		if (segment.parentSegmentId === undefined) continue;
		const values = children[segment.parentSegmentId] ?? [];
		values.push(segment.id);
		children[segment.parentSegmentId] = values;
	}
	return children;
}

/** Finds terminal segments with no children. @public */
export function findTerminalSegments(graph: BranchGraph): readonly BranchSegment[] {
	const hasChildren: Record<number, boolean> = {};
	for (const segment of graph.segments)
		if (segment.parentSegmentId !== undefined) hasChildren[segment.parentSegmentId] = true;
	const result = new Array<BranchSegment>();
	for (const segment of graph.segments) if (hasChildren[segment.id] !== true) result.push(segment);
	return result;
}

/** Queries segments by optional structural and age criteria. @public */
export function querySegments(
	graph: BranchGraph,
	query: {
		readonly order?: number;
		readonly maxDepth?: number;
		readonly ageAtTime?: number;
		readonly tag?: string;
		readonly axisId?: number;
	},
): readonly BranchSegment[] {
	const result = new Array<BranchSegment>();
	for (const segment of graph.segments) {
		if (query.order !== undefined && segment.branchOrder !== query.order) continue;
		if (query.maxDepth !== undefined && segment.depth > query.maxDepth) continue;
		if (query.axisId !== undefined && segment.axisId !== query.axisId) continue;
		if (query.ageAtTime !== undefined && segment.birthTime > query.ageAtTime) continue;
		if (query.tag !== undefined) {
			let found = false;
			for (const tag of segment.tags) if (tag === query.tag) found = true;
			if (!found) continue;
		}
		result.push(segment);
	}
	return result;
}

/** Computes total skeleton length. @public */
export function computeTotalLength(graph: BranchGraph): number {
	let total = 0;
	for (const segment of graph.segments) total += length3(sub3(segment.end, segment.start));
	return total;
}

/** Approximates biomass as the sum of tapered-frustum volumes. @public */
export function computeApproximateBiomass(graph: BranchGraph): number {
	let total = 0;
	for (const segment of graph.segments) {
		const length = length3(sub3(segment.end, segment.start));
		const a = segment.radiusStart;
		const b = segment.radiusEnd;
		total += (math.pi * length * (a * a + a * b + b * b)) / 3;
	}
	return total;
}

/** Uniformly rescales topology without re-deriving it. @public */
export function rescaleBranchGraph(graph: BranchGraph, scale: number): BranchGraph {
	assert(scale > 0, "scale must be positive");
	const nodes = new Array<BranchNode>();
	for (const node of graph.nodes) nodes.push({ ...node, position: scale3(node.position, scale) });
	const segments = new Array<BranchSegment>();
	for (const segment of graph.segments) {
		segments.push({
			...segment,
			start: scale3(segment.start, scale),
			end: scale3(segment.end, scale),
			radiusStart: segment.radiusStart * scale,
			radiusEnd: segment.radiusEnd * scale,
		});
	}
	const attachments = new Array<OrganAttachment>();
	for (const attachment of graph.attachments) {
		attachments.push({
			...attachment,
			transform: { ...attachment.transform, position: scale3(attachment.transform.position, scale) },
		});
	}
	return { ...graph, nodes, segments, attachments, bounds: computeGraphBounds(segments, attachments) };
}

/** Spatial envelope used by pruning and environment-aware models. @public */
export interface SpatialConstraint {
	/** Tests whether a sphere at `position` fits the permitted region. */
	contains(position: Vec3, radius: number): boolean;
}

/** Prunes segments and descendants rejected by a predicate or spatial envelope. @public */
export function pruneBranchGraph(
	graph: BranchGraph,
	keep: (segment: BranchSegment) => boolean,
	constraint?: SpatialConstraint,
): BranchGraph {
	const rejected: Record<number, boolean> = {};
	const kept = new Array<BranchSegment>();
	const remap: Record<number, number> = {};
	for (const segment of depthFirstSegments(graph)) {
		const parentRejected = segment.parentSegmentId !== undefined && rejected[segment.parentSegmentId] === true;
		const permitted =
			!parentRejected &&
			keep(segment) &&
			(constraint === undefined || constraint.contains(segment.end, segment.radiusEnd));
		if (!permitted) {
			rejected[segment.id] = true;
			continue;
		}
		const id = kept.size();
		remap[segment.id] = id;
		const mappedParent = segment.parentSegmentId === undefined ? undefined : remap[segment.parentSegmentId];
		kept.push(mappedParent === undefined ? { ...segment, id } : { ...segment, id, parentSegmentId: mappedParent });
	}
	const attachments = new Array<OrganAttachment>();
	for (const attachment of graph.attachments) {
		if (attachment.segmentId === undefined || rejected[attachment.segmentId] !== true) attachments.push(attachment);
	}
	return { ...graph, segments: kept, attachments, bounds: computeGraphBounds(kept, attachments) };
}

/** Validates references, finiteness, radii, and unintended parent cycles. @public */
export function validateBranchGraph(graph: BranchGraph): readonly Diagnostic[] {
	const diagnostics = new Diagnostics();
	for (let index = 0; index < graph.segments.size(); index++) {
		const segment = graph.segments[index];
		if (segment === undefined) continue;
		if (segment.id !== index)
			diagnostics.error("INVALID_GRAPH", `Segment id ${segment.id} does not match index ${index}.`);
		if (segment.parentSegmentId !== undefined && graph.segments[segment.parentSegmentId] === undefined) {
			diagnostics.error("INVALID_GRAPH", `Segment ${segment.id} references a missing parent.`);
		}
		if (!isFinite3(segment.start) || !isFinite3(segment.end))
			diagnostics.error("INVALID_GRAPH", `Segment ${segment.id} is not finite.`);
		if (!(segment.radiusStart >= 0) || !(segment.radiusEnd >= 0))
			diagnostics.error("INVALID_GRAPH", `Segment ${segment.id} has a negative radius.`);
		let ancestor = segment.parentSegmentId;
		let steps = 0;
		while (ancestor !== undefined && steps <= graph.segments.size()) {
			if (ancestor === segment.id) {
				diagnostics.error("INVALID_GRAPH", `Segment ${segment.id} participates in a parent cycle.`);
				break;
			}
			ancestor = graph.segments[ancestor]?.parentSegmentId;
			steps++;
		}
	}
	return diagnostics.all();
}

function mixHash(hash: number, value: number): number {
	let result = hash ^ (math.floor(value) >>> 0);
	result = (result + (result << 1) + (result << 4) + (result << 7) + (result << 8) + (result << 24)) >>> 0;
	return result >>> 0;
}

/** Stable compact hash used by determinism tests and cache keys. @public */
export function hashBranchGraph(graph: BranchGraph, precision = 100_000): string {
	let hash = 2166136261;
	for (const segment of graph.segments) {
		hash = mixHash(hash, segment.id);
		hash = mixHash(hash, segment.parentSegmentId ?? -1);
		hash = mixHash(hash, segment.axisId);
		hash = mixHash(hash, segment.start.x * precision);
		hash = mixHash(hash, segment.start.y * precision);
		hash = mixHash(hash, segment.start.z * precision);
		hash = mixHash(hash, segment.end.x * precision);
		hash = mixHash(hash, segment.end.y * precision);
		hash = mixHash(hash, segment.end.z * precision);
		hash = mixHash(hash, segment.radiusStart * precision);
		hash = mixHash(hash, segment.radiusEnd * precision);
	}
	return `${hash}`;
}

/** Creates a root transform useful for generic organ attachments. @public */
export function rootTransform(position: Vec3 = vec3(0, 0, 0)): Transform3 {
	return { position, frame: IDENTITY_FRAME, scale: vec3(1, 1, 1) };
}

/** Translates a graph while preserving topology and orientation. @public */
export function translateBranchGraph(graph: BranchGraph, offset: Vec3): BranchGraph {
	const nodes = new Array<BranchNode>();
	for (const node of graph.nodes) nodes.push({ ...node, position: add3(node.position, offset) });
	const segments = new Array<BranchSegment>();
	for (const segment of graph.segments) {
		segments.push({ ...segment, start: add3(segment.start, offset), end: add3(segment.end, offset) });
	}
	const attachments = new Array<OrganAttachment>();
	for (const attachment of graph.attachments) {
		attachments.push({
			...attachment,
			transform: { ...attachment.transform, position: add3(attachment.transform.position, offset) },
		});
	}
	return { ...graph, nodes, segments, attachments, bounds: computeGraphBounds(segments, attachments) };
}
