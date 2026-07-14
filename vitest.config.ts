import { defineConfig } from "vitest/config";

export default defineConfig({
	benchmark: { include: ["benchmarks/**/*.bench.ts"] },
	test: {
		setupFiles: ["./tests/setup.ts"],
		include: ["tests/**/*.test.ts"],
		coverage: { reporter: ["text", "json-summary"], include: ["src/**/*.ts"], exclude: ["src/roblox/**/*.ts"] },
	},
});
