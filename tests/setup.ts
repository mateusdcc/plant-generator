import { afterEach } from "vitest";

declare global {
	interface Array<T> {
		size(): number;
		clear(): void;
		remove(index: number): T | undefined;
	}
	interface ReadonlyArray<T> {
		readonly __plantTestElementType?: T;
		size(): number;
	}
	interface String {
		size(): number;
	}
}

Object.defineProperty(Array.prototype, "size", {
	value(this: unknown[]) {
		return this.length;
	},
	configurable: true,
});
Object.defineProperty(Array.prototype, "clear", {
	value(this: unknown[]) {
		this.splice(0, this.length);
	},
	configurable: true,
});
Object.defineProperty(Array.prototype, "remove", {
	value(this: unknown[], index: number) {
		return this.splice(index, 1)[0];
	},
	configurable: true,
});
Object.defineProperty(String.prototype, "size", {
	value(this: string) {
		return this.length;
	},
	configurable: true,
});

const mathPolyfill = {
	abs: Math.abs,
	acos: Math.acos,
	ceil: Math.ceil,
	clamp: (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value)),
	cos: Math.cos,
	exp: Math.exp,
	floor: Math.floor,
	huge: Number.POSITIVE_INFINITY,
	log: Math.log,
	max: Math.max,
	min: Math.min,
	pi: Math.PI,
	pow: Math.pow,
	sin: Math.sin,
	sqrt: Math.sqrt,
};

Object.assign(globalThis, {
	math: mathPolyfill,
	string: {
		byte: (value: string, start = 1, finish = start) => {
			const bytes: number[] = [];
			for (let index = start - 1; index < finish; index++) bytes.push(value.charCodeAt(index));
			return bytes;
		},
	},
	typeOf: (value: unknown) => {
		if (value === null || value === undefined) return "nil";
		if (typeof value === "object") return "table";
		return typeof value;
	},
	typeIs: (value: unknown, kind: string) =>
		kind === "table" ? typeof value === "object" && value !== null : typeof value === kind,
	pairs: (value: Record<string, unknown> | readonly unknown[]) => Object.entries(value),
	assert: (condition: unknown, message?: string) => {
		if (!condition) throw new Error(message ?? "assertion failed");
		return condition;
	},
});

afterEach(() => {
	// Tests intentionally share no mutable package singleton state.
});
