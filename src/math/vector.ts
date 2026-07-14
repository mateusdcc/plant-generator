/** A renderer-neutral two-dimensional vector. @public */
export interface Vec2 {
	readonly x: number;
	readonly y: number;
}

/** A renderer-neutral three-dimensional vector. @public */
export interface Vec3 {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

/** A stable right-handed local frame. @public */
export interface Frame3 {
	readonly heading: Vec3;
	readonly left: Vec3;
	readonly up: Vec3;
}

/** Position and orientation emitted by geometry-independent placement APIs. @public */
export interface Transform3 {
	readonly position: Vec3;
	readonly frame: Frame3;
	readonly scale: Vec3;
}

/** Creates a two-dimensional vector. @public */
export function vec2(x: number, y: number): Vec2 {
	return { x, y };
}

/** Creates a three-dimensional vector. @public */
export function vec3(x: number, y: number, z: number): Vec3 {
	return { x, y, z };
}

/** The default turtle frame: heading +Y, left -X, up +Z. @public */
export const IDENTITY_FRAME: Frame3 = {
	heading: vec3(0, 1, 0),
	left: vec3(-1, 0, 0),
	up: vec3(0, 0, 1),
};

/** Adds two vectors. @public */
export function add3(a: Vec3, b: Vec3): Vec3 {
	return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
}

/** Subtracts `b` from `a`. @public */
export function sub3(a: Vec3, b: Vec3): Vec3 {
	return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Multiplies a vector by a scalar. @public */
export function scale3(value: Vec3, scalar: number): Vec3 {
	return vec3(value.x * scalar, value.y * scalar, value.z * scalar);
}

/** Computes a dot product. @public */
export function dot3(a: Vec3, b: Vec3): number {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Computes a right-handed cross product. @public */
export function cross3(a: Vec3, b: Vec3): Vec3 {
	return vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

/** Computes squared length without a square root. @public */
export function lengthSquared3(value: Vec3): number {
	return dot3(value, value);
}

/** Computes Euclidean length. @public */
export function length3(value: Vec3): number {
	return math.sqrt(lengthSquared3(value));
}

/** Returns a unit vector or `fallback` for a degenerate input. @public */
export function normalize3(value: Vec3, fallback: Vec3 = vec3(0, 1, 0)): Vec3 {
	const length = length3(value);
	return length > 1e-9 ? scale3(value, 1 / length) : fallback;
}

/** Linearly interpolates between vectors. @public */
export function lerp3(a: Vec3, b: Vec3, alpha: number): Vec3 {
	return add3(a, scale3(sub3(b, a), alpha));
}

/** Returns whether every component is finite. @public */
export function isFinite3(value: Vec3): boolean {
	return isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.z);
}

/** Returns whether a number is finite on both Luau and JavaScript runtimes. @public */
export function isFiniteNumber(value: number): boolean {
	return value === value && value < 1e308 && value > -1e308;
}

/** Rotates a vector around a unit axis using Rodrigues' formula. @public */
export function rotateAroundAxis(value: Vec3, axis: Vec3, radians: number): Vec3 {
	const unitAxis = normalize3(axis);
	const cosine = math.cos(radians);
	const sine = math.sin(radians);
	return add3(
		add3(scale3(value, cosine), scale3(cross3(unitAxis, value), sine)),
		scale3(unitAxis, dot3(unitAxis, value) * (1 - cosine)),
	);
}

/**
 * Removes accumulated floating-point drift from a frame.
 *
 * @remarks Gram-Schmidt is applied in heading/up order, then left is rebuilt
 * from the cross product. This preserves the turtle's forward direction.
 * @public
 */
export function orthonormalize(frame: Frame3): Frame3 {
	const heading = normalize3(frame.heading);
	let up = sub3(frame.up, scale3(heading, dot3(frame.up, heading)));
	if (lengthSquared3(up) < 1e-12) {
		const fallback = math.abs(heading.z) < 0.9 ? vec3(0, 0, 1) : vec3(1, 0, 0);
		up = sub3(fallback, scale3(heading, dot3(fallback, heading)));
	}
	up = normalize3(up);
	const left = normalize3(cross3(up, heading), vec3(-1, 0, 0));
	return { heading, left, up: normalize3(cross3(heading, left), up) };
}

/** Rotates every basis vector around an axis and re-orthogonalizes. @public */
export function rotateFrame(frame: Frame3, axis: Vec3, radians: number): Frame3 {
	return orthonormalize({
		heading: rotateAroundAxis(frame.heading, axis, radians),
		left: rotateAroundAxis(frame.left, axis, radians),
		up: rotateAroundAxis(frame.up, axis, radians),
	});
}

/** Applies a local-frame transform to a point. @public */
export function transformPoint(transform: Transform3, point: Vec3): Vec3 {
	const scaled = vec3(point.x * transform.scale.x, point.y * transform.scale.y, point.z * transform.scale.z);
	return add3(
		transform.position,
		add3(
			scale3(transform.frame.left, -scaled.x),
			add3(scale3(transform.frame.heading, scaled.y), scale3(transform.frame.up, scaled.z)),
		),
	);
}
