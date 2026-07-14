import { IDENTITY_FRAME, rotateFrame, type Transform3, vec3 } from "../math/vector";

/** Composable inflorescence topology. @public */
export type InflorescenceKind = "raceme" | "spike" | "panicle" | "umbel" | "cyme" | "capitulum";

/** Flower or branch attachment in an inflorescence. @public */
export interface InflorescenceAttachment {
	readonly id: number;
	readonly kind: "flower" | "pedicel" | "branch";
	readonly transform: Transform3;
	readonly birthTime: number;
	readonly maturationDuration: number;
	readonly terminal: boolean;
}

/** Inflorescence construction options. @public */
export interface InflorescenceSpec {
	readonly kind: InflorescenceKind;
	readonly count: number;
	readonly length?: number;
	readonly radius?: number;
	readonly divergenceAngle?: number;
	readonly birthInterval?: number;
	readonly maturationDuration?: number;
	readonly terminalFlower?: boolean;
}

/** Builds botanical attachment topology without choosing organ geometry. @public */
export function createInflorescence(spec: InflorescenceSpec): readonly InflorescenceAttachment[] {
	const count = math.max(1, math.floor(spec.count));
	const length = spec.length ?? 1;
	const radius = spec.radius ?? 0.35;
	const divergence = spec.divergenceAngle ?? math.pi * (3 - math.sqrt(5));
	const result = new Array<InflorescenceAttachment>();
	for (let index = 0; index < count; index++) {
		const t = count <= 1 ? 1 : index / (count - 1);
		const angle = index * divergence;
		let radial = radius;
		let height = t * length;
		let kind: "flower" | "pedicel" | "branch" = "flower";
		if (spec.kind === "spike") radial = 0.08;
		if (spec.kind === "umbel") height = length;
		if (spec.kind === "capitulum") {
			radial = radius * math.sqrt(t);
			height = length;
		}
		if (spec.kind === "panicle") {
			radial *= 1 - t * 0.7;
			kind = "branch";
		}
		if (spec.kind === "cyme") {
			radial *= 0.5 + 0.5 * (index % 2);
			height = math.floor(index / 2) * (length / math.max(1, count / 2));
		}
		const outward = vec3(math.cos(angle), math.sin(angle), 0);
		let frame = rotateFrame(IDENTITY_FRAME, IDENTITY_FRAME.up, angle);
		frame = rotateFrame(frame, frame.left, spec.kind === "umbel" ? -math.pi / 3 : -math.pi / 6);
		result.push({
			id: result.size(),
			kind,
			transform: { position: vec3(outward.x * radial, outward.y * radial, height), frame, scale: vec3(1, 1, 1) },
			birthTime: index * (spec.birthInterval ?? 1),
			maturationDuration: spec.maturationDuration ?? 2,
			terminal: false,
		});
	}
	if (spec.terminalFlower === true || spec.kind === "cyme") {
		result.push({
			id: result.size(),
			kind: "flower",
			transform: { position: vec3(0, 0, length), frame: IDENTITY_FRAME, scale: vec3(1, 1, 1) },
			birthTime: count * (spec.birthInterval ?? 1),
			maturationDuration: spec.maturationDuration ?? 2,
			terminal: true,
		});
	}
	return result;
}

/** High-level herbaceous branching pattern. @public */
export type HerbaceousBranchingPattern = "monopodial" | "sympodial" | "polypodial";

/** Maps botanical branching terminology to reusable tree-policy parameters. @public */
export function herbaceousBranchingPolicy(pattern: HerbaceousBranchingPattern): {
	readonly childrenPerApex: number;
	readonly lengthDecay: number;
	readonly inclinationRadians: number;
} {
	if (pattern === "monopodial") return { childrenPerApex: 2, lengthDecay: 0.72, inclinationRadians: math.pi / 4 };
	if (pattern === "sympodial") return { childrenPerApex: 2, lengthDecay: 0.9, inclinationRadians: math.pi / 6 };
	return { childrenPerApex: 3, lengthDecay: 0.76, inclinationRadians: math.pi / 3 };
}
