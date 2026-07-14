import prettierConfig from "eslint-config-prettier";
import robloxTs from "eslint-plugin-roblox-ts";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
	{
		ignores: ["out/**", "docs-site/**", "coverage/**", "tmp/**", "fixtures/**/out/**"],
	},
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parser: tsParser,
			parserOptions: { project: "./tsconfig.json", sourceType: "module" },
		},
		plugins: { "@typescript-eslint": tseslint, "roblox-ts": robloxTs },
		rules: {
			...tseslint.configs.recommended.rules,
			...robloxTs.configs["recommended-legacy"].rules,
			...prettierConfig.rules,
			"@typescript-eslint/consistent-type-imports": "error",
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
		},
	},
	{
		files: ["tests/**/*.ts", "vitest.config.ts"],
		languageOptions: { parser: tsParser, parserOptions: { sourceType: "module" } },
		plugins: { "@typescript-eslint": tseslint },
		rules: { ...tseslint.configs.recommended.rules, ...prettierConfig.rules },
	},
];
