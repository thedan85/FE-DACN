import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
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
