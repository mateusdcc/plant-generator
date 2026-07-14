import { XorShift32, type RandomSource } from "../math/random";
import {
	IDENTITY_FRAME,
	add3,
	dot3,
	lengthSquared3,
	normalize3,
	rotateFrame,
	scale3,
	type Frame3,
	type Vec3,
	vec3,
} from "../math/vector";
import {
	computeGraphBounds,
	type BranchGraph,
	type BranchNode,
	type BranchSegment,
	type Bud,
	type PlantAxis,
	type SpatialConstraint,
} from "../topology/branch-graph";
import type { DirectionalField } from "../turtle/interpreter";

/** Reusable recursive tree policy inspired by the parameterized models in Chapter 2. @public */
export interface TreeModelSpec {
	readonly maxDepth: number;
	readonly childrenPerApex: number;
	readonly internodesPerAxis?: number;
	readonly initialLength: number;
	readonly initialRadius: number;
	readonly lengthDecay: number;
	readonly radiusDecay: number;
	readonly inclinationRadians: number;
	readonly azimuthStepRadians?: number;
	readonly inclinationJitter?: number;
	readonly azimuthJitter?: number;
	readonly curvatureRadians?: number;
	readonly branchPositionBias?: number;
	readonly birthInterval?: number;
	readonly seed?: number;
	readonly random?: RandomSource;
	readonly directionalField?: DirectionalField;
	readonly directionalStrength?: number;
	readonly spatialConstraint?: SpatialConstraint;
	readonly maxSegments?: number;
}

interface AxisWork {
	position: Vec3;
	frame: Frame3;
	length: number;
	radius: number;
	depth: number;
	order: number;
	parentSegmentId?: number;
	parentNodeId: number;
	axisId: number;
	birthTime: number;
}

function bendToward(frame: Frame3, position: Vec3, field: DirectionalField | undefined, strength: number): Frame3 {
	if (field === undefined || strength <= 0) return frame;
	const direction = normalize3(field.direction(position, { id: "tree", parameters: [] }), frame.heading);
	const axis = {
		x: frame.heading.y * direction.z - frame.heading.z * direction.y,
		y: frame.heading.z * direction.x - frame.heading.x * direction.z,
		z: frame.heading.x * direction.y - frame.heading.y * direction.x,
	};
	if (lengthSquared3(axis) < 1e-12) return frame;
	return rotateFrame(
		frame,
		axis,
		math.acos(math.clamp(dot3(frame.heading, direction), -1, 1)) * math.clamp(strength, 0, 1),
	);
}

/**
 * Generates deterministic branch topology from reusable branching policies.
 *
 * @remarks The implementation is iterative, supports crown constraints and
 * environment fields, and does not create geometry or Instances.
 * @public
 */
export function createTreeGraph(spec: TreeModelSpec): BranchGraph {
	const random = spec.random ?? new XorShift32(spec.seed ?? 1);
	const internodes = math.max(1, math.floor(spec.internodesPerAxis ?? 1));
	const maximumSegments = math.max(1, math.floor(spec.maxSegments ?? 10_000));
	const nodes = new Array<BranchNode>();
	const segments = new Array<BranchSegment>();
	const axes = new Array<PlantAxis>();
	const axisSegments = new Array<number[]>();
	const buds = new Array<Bud>();
	nodes.push({ id: 0, position: vec3(0, 0, 0), outgoingSegmentIds: [], birthTime: 0 });
	axisSegments.push([]);
	const queue = new Array<AxisWork>();
	queue.push({
		position: vec3(0, 0, 0),
		frame: IDENTITY_FRAME,
		length: spec.initialLength,
		radius: spec.initialRadius,
		depth: 0,
		order: 0,
		parentNodeId: 0,
		axisId: 0,
		birthTime: 0,
	});
	let cursor = 0;
	while (cursor < queue.size() && segments.size() < maximumSegments) {
		const work = queue[cursor++];
		if (work === undefined) continue;
		let position = work.position;
		let frame = work.frame;
		let parentNodeId = work.parentNodeId;
		let parentSegmentId = work.parentSegmentId;
		let accepted = true;
		for (let internode = 0; internode < internodes && segments.size() < maximumSegments; internode++) {
			frame = bendToward(frame, position, spec.directionalField, spec.directionalStrength ?? 0);
			if ((spec.curvatureRadians ?? 0) !== 0) frame = rotateFrame(frame, frame.left, spec.curvatureRadians ?? 0);
			const length = (work.length / internodes) * (1 + (random.nextNumber() * 2 - 1) * 0.05);
			const endpoint = add3(position, scale3(frame.heading, length));
			const endRadius = work.radius * (1 - ((internode + 1) / internodes) * (1 - spec.radiusDecay));
			if (spec.spatialConstraint !== undefined && !spec.spatialConstraint.contains(endpoint, endRadius)) {
				accepted = false;
				break;
			}
			const id = segments.size();
			const endNodeId = nodes.size();
			const segment: BranchSegment = {
				id,
				...(parentSegmentId === undefined ? {} : { parentSegmentId }),
				axisId: work.axisId,
				startNodeId: parentNodeId,
				endNodeId,
				start: position,
				end: endpoint,
				frame,
				radiusStart: internode === 0 ? work.radius : (segments[parentSegmentId ?? 0]?.radiusEnd ?? work.radius),
				radiusEnd: math.max(0, endRadius),
				branchOrder: work.order,
				depth: work.depth * internodes + internode,
				birthTime: work.birthTime + internode * (spec.birthInterval ?? 1),
				tags: [work.order === 0 ? "trunk" : "branch"],
				metadata: { recursiveDepth: work.depth },
			};
			segments.push(segment);
			axisSegments[work.axisId]?.push(id);
			const parentNode = nodes[parentNodeId];
			if (parentNode !== undefined)
				nodes[parentNodeId] = { ...parentNode, outgoingSegmentIds: [...parentNode.outgoingSegmentIds, id] };
			nodes.push({
				id: endNodeId,
				position: endpoint,
				incomingSegmentId: id,
				outgoingSegmentIds: [],
				birthTime: segment.birthTime,
			});
			position = endpoint;
			parentNodeId = endNodeId;
			parentSegmentId = id;
		}
		if (work.depth >= spec.maxDepth || !accepted || parentSegmentId === undefined) {
			buds.push({
				id: buds.size(),
				nodeId: parentNodeId,
				kind: "apical",
				state: accepted ? "dormant" : "dead",
				birthTime: work.birthTime,
				...(accepted ? {} : { deathTime: work.birthTime }),
				resource: math.pow(spec.lengthDecay, work.depth),
			});
			continue;
		}
		const children = math.max(1, math.floor(spec.childrenPerApex));
		for (let child = 0; child < children; child++) {
			const childAxisId = axisSegments.size();
			axisSegments.push([]);
			const azimuth =
				child * (spec.azimuthStepRadians ?? (math.pi * 2) / children) +
				(random.nextNumber() * 2 - 1) * (spec.azimuthJitter ?? 0);
			const inclination = spec.inclinationRadians + (random.nextNumber() * 2 - 1) * (spec.inclinationJitter ?? 0);
			let childFrame = rotateFrame(frame, frame.up, azimuth);
			childFrame = rotateFrame(childFrame, childFrame.left, inclination);
			queue.push({
				position,
				frame: childFrame,
				length: work.length * spec.lengthDecay,
				radius: work.radius * spec.radiusDecay,
				depth: work.depth + 1,
				order: work.order + 1,
				parentSegmentId,
				parentNodeId,
				axisId: childAxisId,
				birthTime: work.birthTime + internodes * (spec.birthInterval ?? 1),
			});
		}
	}
	for (let id = 0; id < axisSegments.size(); id++) {
		const segmentIds = axisSegments[id] ?? [];
		const first = segments[segmentIds[0] ?? -1];
		axes.push({ id, order: first?.branchOrder ?? 0, segmentIds });
	}
	return { nodes, segments, axes, buds, attachments: [], bounds: computeGraphBounds(segments) };
}

/** Common crown/envelope constraint. @public */
export class EllipsoidConstraint implements SpatialConstraint {
	public constructor(
		private readonly center: Vec3,
		private readonly radii: Vec3,
	) {}

	/** Tests whether a branch-radius sphere remains inside the ellipsoid. */
	public contains(position: Vec3, radius: number): boolean {
		const x = (position.x - this.center.x) / math.max(this.radii.x - radius, 1e-6);
		const y = (position.y - this.center.y) / math.max(this.radii.y - radius, 1e-6);
		const z = (position.z - this.center.z) / math.max(this.radii.z - radius, 1e-6);
		return x * x + y * y + z * z <= 1;
	}
}
