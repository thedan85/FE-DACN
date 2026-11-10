import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const compat = new FlatCompat({
	baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = defineConfig([
	...compat.extends("next/core-web-vitals", "next/typescript"),
	// Override default ignores of eslint-config-next.
	globalIgnores([
		// Default ignores of eslint-config-next:
		".next/**",
		"out/**",
		"build/**",
		"next-env.d.ts",
		".agents/**",
		".opencode/**",
		// Everything git ignores: tickets, agent scratch scripts, generated test
		// output. Linting these reports on files that never ship.
		".scratch/**",
		".playwright-cli/**",
		"test-results/**",
		"playwright-report/**",
		"blob-report/**",
		"coverage/**",
	]),
]);

export default eslintConfig;
