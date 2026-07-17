import { Diagnostics, type Diagnostic } from "../core/diagnostics";
import type { ModuleSymbol, StructuredParameter, SymbolId } from "../core/symbols";
import {
	IDENTITY_FRAME,
	add3,
	dot3,
	lengthSquared3,
	normalize3,
	orthonormalize,
	rotateFrame,
	scale3,
	type Frame3,
	type Vec2,
	type Vec3,
	vec2,
	vec3,
} from "../math/vector";
import { DEFAULT_LIMITS, type GenerationLimits } from "../runtime/limits";
import {
	computeGraphBounds,
	type BranchGraph,
	type BranchNode,
	type BranchSegment,
	type OrganAttachment,
	type PlantAxis,
} from "../topology/branch-graph";

/** Supported built-in turtle actions. @public */
export type TurtleAction =
	| "draw"
	| "move"
	| "yaw-left"
	| "yaw-right"
	| "pitch-up"
	| "pitch-down"
	| "roll-left"
	| "roll-right"
	| "turn-around"
	| "push"
	| "pop"
	| "set-width"
	| "decrease-width"
	| "polygon-begin"
	| "polygon-vertex"
	| "polygon-end"
	| "align-vertical";

/** Maps an alphabet symbol to a turtle action. @public */
export interface TurtleCommandMapping {
	readonly symbol: SymbolId;
	readonly action: TurtleAction;
}

/** Maps a non-drawing module to a botanical attachment socket. @public */
export interface TurtleAttachmentMapping {
	readonly symbol: SymbolId;
	readonly kind: string;
}

/** Direction field used for tropism, wind, gravity, or light. @public */
export interface DirectionalField {
	/** Samples the desired direction at a turtle position and source symbol. */
	direction(position: Vec3, symbol: ModuleSymbol): Vec3;
}

/** Optional directional bias applied after forward commands. @public */
export interface TropismSpec {
	readonly field: DirectionalField;
	readonly strength: number;
}

/** Mutable command context passed to custom turtle extensions. @public */
export interface TurtleCommandContext {
	readonly symbol: ModuleSymbol;
	readonly index: number;
	/** Returns the current renderer-neutral turtle position. */
	getPosition(): Vec3;
	/** Replaces the current turtle position. */
	setPosition(position: Vec3): void;
	/** Returns the current orthonormal turtle frame. */
	getFrame(): Frame3;
	/** Replaces and re-orthonormalizes the turtle frame. */
	setFrame(frame: Frame3): void;
	/** Returns the current branch width. */
	getWidth(): number;
	/** Replaces the current nonnegative branch width. */
	setWidth(width: number): void;
}

/** Consumer-defined symbol command. @public */
export interface TurtleCommand {
	readonly symbol: SymbolId;
	/** Applies a custom command and may emit geometry through the sink. */
	execute(context: TurtleCommandContext, sink: GeometrySink): void;
}

/** Streaming output boundary for custom interpreters and renderers. @public */
export interface GeometrySink {
	/** Receives each completed branch segment. */
	onSegment?(segment: BranchSegment): void;
	/** Receives each leaf, flower, fruit, or custom organ socket. */
	onAttachment?(attachment: OrganAttachment): void;
	/** Receives each completed polygon contour. */
	onPolygon?(polygon: readonly Vec3[]): void;
}

/** Configuration shared by the 3D turtle interpreter. @public */
export interface Turtle3DOptions {
	readonly stepSize?: number;
	readonly angleRadians?: number;
	readonly initialWidth?: number;
	readonly widthDecay?: number;
	readonly initialPosition?: Vec3;
	readonly initialFrame?: Frame3;
	readonly mappings?: readonly TurtleCommandMapping[];
	readonly attachmentMappings?: readonly TurtleAttachmentMapping[];
	readonly customCommands?: readonly TurtleCommand[];
	readonly unknownSymbolPolicy?: "ignore" | "warn" | "error";
	readonly tropism?: TropismSpec;
	readonly limits?: Partial<GenerationLimits>;
	readonly sink?: GeometrySink;
	readonly trace?: boolean;
}

/** Polygon and branch output from 3D turtle interpretation. @public */
export interface Turtle3DResult {
	readonly branchGraph: BranchGraph;
	readonly polygons: readonly (readonly Vec3[])[];
	readonly diagnostics: readonly Diagnostic[];
	readonly processedSymbols: number;
	readonly maxStackDepth: number;
}

/** Line emitted by the 2D interpreter. @public */
export interface TurtleSegment2D {
	readonly start: Vec2;
	readonly end: Vec2;
	readonly width: number;
	readonly sourceIndex: number;
}

/** 2D turtle output. @public */
export interface Turtle2DResult {
	readonly segments: readonly TurtleSegment2D[];
	readonly polygons: readonly (readonly Vec2[])[];
	readonly diagnostics: readonly Diagnostic[];
}

interface MutableTurtleState {
	position: Vec3;
	frame: Frame3;
	width: number;
	parentSegmentId: number | undefined;
	currentNodeId: number;
	axisId: number;
	branchOrder: number;
	depth: number;
	attributes: StructuredParameter;
}

class MutableCommandContext implements TurtleCommandContext {
	public constructor(
		public readonly symbol: ModuleSymbol,
		public readonly index: number,
		private readonly state: MutableTurtleState,
	) {}

	public getPosition(): Vec3 {
		return this.state.position;
	}

	public setPosition(position: Vec3): void {
		this.state.position = position;
	}

	public getFrame(): Frame3 {
		return this.state.frame;
	}

	public setFrame(frame: Frame3): void {
		this.state.frame = orthonormalize(frame);
	}

	public getWidth(): number {
		return this.state.width;
	}

	public setWidth(width: number): void {
		this.state.width = math.max(0, width);
	}
}

/** Canonical commands based on Appendix C, all replaceable by custom mappings. @public */
export const CANONICAL_TURTLE_COMMANDS: readonly TurtleCommandMapping[] = [
	{ symbol: "F", action: "draw" },
	{ symbol: "f", action: "move" },
	{ symbol: "+", action: "yaw-left" },
	{ symbol: "-", action: "yaw-right" },
	{ symbol: "^", action: "pitch-up" },
	{ symbol: "&", action: "pitch-down" },
	{ symbol: "\\", action: "roll-left" },
	{ symbol: "/", action: "roll-right" },
	{ symbol: "|", action: "turn-around" },
	{ symbol: "[", action: "push" },
	{ symbol: "]", action: "pop" },
	{ symbol: "!", action: "decrease-width" },
	{ symbol: "{", action: "polygon-begin" },
	{ symbol: ".", action: "polygon-vertex" },
	{ symbol: "}", action: "polygon-end" },
	{ symbol: "$", action: "align-vertical" },
];

function sameId(a: SymbolId, b: SymbolId): boolean {
	return typeOf(a) === typeOf(b) && a === b;
}

function findAction(mappings: readonly TurtleCommandMapping[], id: SymbolId): TurtleAction | undefined {
	for (const mapping of mappings) if (sameId(mapping.symbol, id)) return mapping.action;
	return undefined;
}

function findAttachmentKind(mappings: readonly TurtleAttachmentMapping[], id: SymbolId): string | undefined {
	for (const mapping of mappings) if (sameId(mapping.symbol, id)) return mapping.kind;
	return undefined;
}

function numericParameter(value: ModuleSymbol, index: number, fallback: number): number {
	const parameter = value.parameters[index];
	return typeIs(parameter, "number") ? parameter : fallback;
}

function cloneState(state: MutableTurtleState): MutableTurtleState {
	return { ...state, attributes: { ...state.attributes } };
}

function applyTropism(state: MutableTurtleState, symbolValue: ModuleSymbol, tropism: TropismSpec | undefined): void {
	if (tropism === undefined || tropism.strength === 0) return;
	const direction = normalize3(tropism.field.direction(state.position, symbolValue), state.frame.heading);
	const axis = {
		x: state.frame.heading.y * direction.z - state.frame.heading.z * direction.y,
		y: state.frame.heading.z * direction.x - state.frame.heading.x * direction.z,
		z: state.frame.heading.x * direction.y - state.frame.heading.y * direction.x,
	};
	if (lengthSquared3(axis) < 1e-12) return;
	const alignment = math.clamp(dot3(state.frame.heading, direction), -1, 1);
	const angle = math.acos(alignment) * math.clamp(tropism.strength, 0, 1);
	state.frame = rotateFrame(state.frame, axis, angle);
}

function mergedLimits(overrides: Partial<GenerationLimits> | undefined): GenerationLimits {
	return {
		maxIterations: overrides?.maxIterations ?? DEFAULT_LIMITS.maxIterations,
		maxSymbols: overrides?.maxSymbols ?? DEFAULT_LIMITS.maxSymbols,
		maxBranchDepth: overrides?.maxBranchDepth ?? DEFAULT_LIMITS.maxBranchDepth,
		maxStackDepth: overrides?.maxStackDepth ?? DEFAULT_LIMITS.maxStackDepth,
		maxSegments: overrides?.maxSegments ?? DEFAULT_LIMITS.maxSegments,
		maxOrgans: overrides?.maxOrgans ?? DEFAULT_LIMITS.maxOrgans,
		maxVertices: overrides?.maxVertices ?? DEFAULT_LIMITS.maxVertices,
		maxTriangles: overrides?.maxTriangles ?? DEFAULT_LIMITS.maxTriangles,
		maxWorkUnits: overrides?.maxWorkUnits ?? DEFAULT_LIMITS.maxWorkUnits,
		maxRenderedInstances: overrides?.maxRenderedInstances ?? DEFAULT_LIMITS.maxRenderedInstances,
	};
}

/**
 * Interprets symbols iteratively into branch topology and polygon paths.
 *
 * @remarks The heading/left/up frame is re-orthogonalized after rotations to
 * avoid drift in long derivations (Chapter 1, Section 1.5).
 * @public
 */
export function interpret3D(word: readonly ModuleSymbol[], options: Turtle3DOptions = {}): Turtle3DResult {
	const diagnostics = new Diagnostics();
	const limits = mergedLimits(options.limits);
	const mappings = options.mappings ?? CANONICAL_TURTLE_COMMANDS;
	const attachmentMappings = options.attachmentMappings ?? [];
	const customCommands = options.customCommands ?? [];
	const stepSize = options.stepSize ?? 1;
	const angle = options.angleRadians ?? math.pi / 6;
	const widthDecay = options.widthDecay ?? 0.9;
	const nodes = new Array<BranchNode>();
	const segments = new Array<BranchSegment>();
	const axes = new Array<PlantAxis>();
	const axisSegments = new Array<number[]>();
	const attachments = new Array<OrganAttachment>();
	const polygons = new Array<readonly Vec3[]>();
	let activePolygon: Vec3[] | undefined;
	const startPosition = options.initialPosition ?? vec3(0, 0, 0);
	nodes.push({ id: 0, position: startPosition, outgoingSegmentIds: [], birthTime: 0 });
	axisSegments.push([]);
	const state: MutableTurtleState = {
		position: startPosition,
		frame: orthonormalize(options.initialFrame ?? IDENTITY_FRAME),
		width: options.initialWidth ?? 0.1,
		parentSegmentId: undefined,
		currentNodeId: 0,
		axisId: 0,
		branchOrder: 0,
		depth: 0,
		attributes: {},
	};
	const stack = new Array<MutableTurtleState>();
	let maxStackDepth = 0;
	let processed = 0;
	let attachmentLimitReported = false;
	for (let index = 0; index < word.size(); index++) {
		const symbolValue = word[index];
		if (symbolValue === undefined) continue;
		processed++;
		const action = findAction(mappings, symbolValue.id);
		let custom: TurtleCommand | undefined;
		if (action === undefined)
			for (const candidate of customCommands) if (sameId(candidate.symbol, symbolValue.id)) custom = candidate;
		if (custom !== undefined) {
			const context = new MutableCommandContext(symbolValue, index, state);
			custom.execute(context, options.sink ?? {});
			continue;
		}
		if (action === undefined) {
			const attachmentKind = findAttachmentKind(attachmentMappings, symbolValue.id);
			if (attachmentKind !== undefined) {
				if (attachments.size() >= limits.maxOrgans) {
					if (!attachmentLimitReported) {
						diagnostics.warn("LIMIT_ORGANS", "Turtle reached its attachment limit.", {
							symbolIndex: index,
						});
						attachmentLimitReported = true;
					}
					continue;
				}
				const attachment: OrganAttachment = {
					id: attachments.size(),
					nodeId: state.currentNodeId,
					...(state.parentSegmentId === undefined ? {} : { segmentId: state.parentSegmentId }),
					kind: attachmentKind,
					transform: { position: state.position, frame: state.frame, scale: vec3(1, 1, 1) },
					birthTime: symbolValue.birthTime ?? nodes[state.currentNodeId]?.birthTime ?? 0,
					metadata: { sourceSymbol: `${symbolValue.id}` },
				};
				attachments.push(attachment);
				options.sink?.onAttachment?.(attachment);
				continue;
			}
			if (options.unknownSymbolPolicy === "warn")
				diagnostics.warn("UNKNOWN_SYMBOL", `No turtle command for ${symbolValue.id}.`, { symbolIndex: index });
			if (options.unknownSymbolPolicy === "error")
				diagnostics.error("UNKNOWN_SYMBOL", `No turtle command for ${symbolValue.id}.`, { symbolIndex: index });
			continue;
		}
		const commandAngle = numericParameter(symbolValue, 0, angle);
		switch (action) {
			case "draw": {
				if (segments.size() >= limits.maxSegments) {
					diagnostics.warn("LIMIT_SEGMENTS", "Turtle reached its segment limit.", { symbolIndex: index });
					index = word.size();
					break;
				}
				const length = numericParameter(symbolValue, 0, stepSize);
				const endpoint = add3(state.position, scale3(state.frame.heading, length));
				const startNode = nodes[state.currentNodeId];
				const endNodeId = nodes.size();
				const segmentId = segments.size();
				const birthTime = symbolValue.birthTime ?? 0;
				const segment: BranchSegment = {
					id: segmentId,
					...(state.parentSegmentId === undefined ? {} : { parentSegmentId: state.parentSegmentId }),
					axisId: state.axisId,
					startNodeId: state.currentNodeId,
					endNodeId,
					start: state.position,
					end: endpoint,
					frame: state.frame,
					radiusStart: state.width,
					radiusEnd: state.width * widthDecay,
					branchOrder: state.branchOrder,
					depth: state.depth,
					birthTime,
					tags: [],
					metadata: state.attributes,
				};
				segments.push(segment);
				axisSegments[state.axisId]?.push(segmentId);
				if (startNode !== undefined) {
					const outgoing = new Array<number>();
					for (const id of startNode.outgoingSegmentIds) outgoing.push(id);
					outgoing.push(segmentId);
					nodes[state.currentNodeId] = { ...startNode, outgoingSegmentIds: outgoing };
				}
				nodes.push({
					id: endNodeId,
					position: endpoint,
					incomingSegmentId: segmentId,
					outgoingSegmentIds: [],
					birthTime,
				});
				state.position = endpoint;
				state.currentNodeId = endNodeId;
				state.parentSegmentId = segmentId;
				state.width *= widthDecay;
				state.depth++;
				options.sink?.onSegment?.(segment);
				applyTropism(state, symbolValue, options.tropism);
				break;
			}
			case "move":
				state.position = add3(
					state.position,
					scale3(state.frame.heading, numericParameter(symbolValue, 0, stepSize)),
				);
				applyTropism(state, symbolValue, options.tropism);
				break;
			case "yaw-left":
				state.frame = rotateFrame(state.frame, state.frame.up, commandAngle);
				break;
			case "yaw-right":
				state.frame = rotateFrame(state.frame, state.frame.up, -commandAngle);
				break;
			case "pitch-up":
				state.frame = rotateFrame(state.frame, state.frame.left, commandAngle);
				break;
			case "pitch-down":
				state.frame = rotateFrame(state.frame, state.frame.left, -commandAngle);
				break;
			case "roll-left":
				state.frame = rotateFrame(state.frame, state.frame.heading, commandAngle);
				break;
			case "roll-right":
				state.frame = rotateFrame(state.frame, state.frame.heading, -commandAngle);
				break;
			case "turn-around":
				state.frame = rotateFrame(state.frame, state.frame.up, math.pi);
				break;
			case "push":
				if (stack.size() >= limits.maxStackDepth)
					diagnostics.warn("LIMIT_STACK", "Turtle stack limit reached.", { symbolIndex: index });
				else {
					stack.push(cloneState(state));
					maxStackDepth = math.max(maxStackDepth, stack.size());
					state.axisId = axisSegments.size();
					axisSegments.push([]);
					state.branchOrder++;
				}
				break;
			case "pop": {
				const restored = stack.pop();
				if (restored === undefined)
					diagnostics.error("UNBALANCED_BRANCH", "Turtle pop has no matching push.", { symbolIndex: index });
				else {
					state.position = restored.position;
					state.frame = restored.frame;
					state.width = restored.width;
					state.parentSegmentId = restored.parentSegmentId;
					state.currentNodeId = restored.currentNodeId;
					state.axisId = restored.axisId;
					state.branchOrder = restored.branchOrder;
					state.depth = restored.depth;
					state.attributes = restored.attributes;
				}
				break;
			}
			case "set-width":
				state.width = math.max(0, numericParameter(symbolValue, 0, state.width));
				break;
			case "decrease-width":
				state.width *= numericParameter(symbolValue, 0, widthDecay);
				break;
			case "polygon-begin":
				activePolygon = [];
				break;
			case "polygon-vertex":
				activePolygon?.push(state.position);
				break;
			case "polygon-end":
				if (activePolygon !== undefined && activePolygon.size() >= 3) {
					polygons.push(activePolygon);
					options.sink?.onPolygon?.(activePolygon);
				}
				activePolygon = undefined;
				break;
			case "align-vertical": {
				const worldUp = vec3(0, 0, 1);
				const left = normalize3(
					{
						x: worldUp.y * state.frame.heading.z - worldUp.z * state.frame.heading.y,
						y: worldUp.z * state.frame.heading.x - worldUp.x * state.frame.heading.z,
						z: worldUp.x * state.frame.heading.y - worldUp.y * state.frame.heading.x,
					},
					state.frame.left,
				);
				state.frame = orthonormalize({ heading: state.frame.heading, left, up: worldUp });
				break;
			}
		}
	}
	if (stack.size() > 0) diagnostics.error("UNBALANCED_BRANCH", "Turtle word ends with pushed states.");
	for (let id = 0; id < axisSegments.size(); id++) {
		const segmentIds = axisSegments[id] ?? [];
		let order = 0;
		if (segmentIds.size() > 0) order = segments[segmentIds[0] ?? 0]?.branchOrder ?? 0;
		axes.push({ id, order, segmentIds });
	}
	const graph: BranchGraph = {
		nodes,
		segments,
		axes,
		buds: [],
		attachments,
		bounds: computeGraphBounds(segments, attachments),
	};
	return { branchGraph: graph, polygons, diagnostics: diagnostics.all(), processedSymbols: processed, maxStackDepth };
}

/** Interprets the 2D subset with push/pop and polygon capture. @public */
export function interpret2D(
	word: readonly ModuleSymbol[],
	options: { readonly stepSize?: number; readonly angleRadians?: number; readonly initialWidth?: number } = {},
): Turtle2DResult {
	const diagnostics = new Diagnostics();
	const segments = new Array<TurtleSegment2D>();
	const polygons = new Array<readonly Vec2[]>();
	const stack = new Array<{ position: Vec2; angle: number; width: number }>();
	let position = vec2(0, 0);
	let heading = math.pi / 2;
	let width = options.initialWidth ?? 1;
	let activePolygon: Vec2[] | undefined;
	for (let index = 0; index < word.size(); index++) {
		const value = word[index];
		if (value === undefined) continue;
		const action = findAction(CANONICAL_TURTLE_COMMANDS, value.id);
		const angle = numericParameter(value, 0, options.angleRadians ?? math.pi / 2);
		if (action === "draw" || action === "move") {
			const length = numericParameter(value, 0, options.stepSize ?? 1);
			const endpoint = vec2(position.x + math.cos(heading) * length, position.y + math.sin(heading) * length);
			if (action === "draw") segments.push({ start: position, end: endpoint, width, sourceIndex: index });
			position = endpoint;
		} else if (action === "yaw-left") heading += angle;
		else if (action === "yaw-right") heading -= angle;
		else if (action === "turn-around") heading += math.pi;
		else if (action === "push") stack.push({ position, angle: heading, width });
		else if (action === "pop") {
			const restored = stack.pop();
			if (restored === undefined)
				diagnostics.error("UNBALANCED_BRANCH", "2D turtle pop has no matching push.", { symbolIndex: index });
			else {
				position = restored.position;
				heading = restored.angle;
				width = restored.width;
			}
		} else if (action === "set-width") width = math.max(0, numericParameter(value, 0, width));
		else if (action === "decrease-width") width *= numericParameter(value, 0, 0.9);
		else if (action === "polygon-begin") activePolygon = [];
		else if (action === "polygon-vertex") activePolygon?.push(position);
		else if (action === "polygon-end") {
			if (activePolygon !== undefined && activePolygon.size() >= 3) polygons.push(activePolygon);
			activePolygon = undefined;
		}
	}
	if (stack.size() > 0) diagnostics.error("UNBALANCED_BRANCH", "2D turtle word ends with pushed states.");
	return { segments, polygons, diagnostics: diagnostics.all() };
}

/** Constant directional field for gravity, light, or wind. @public */
export class ConstantDirectionalField implements DirectionalField {
	public constructor(private readonly value: Vec3) {}

	/** Returns the same configured direction for every sample. */
	public direction(_position: Vec3, _symbol: ModuleSymbol): Vec3 {
		return this.value;
	}
}
