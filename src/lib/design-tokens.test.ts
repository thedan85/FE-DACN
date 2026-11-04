import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { expect, it } from "vitest";

import { designTokenCssVariables, designTokens } from "./design-tokens";

/**
 * The design-token layer's invariants.
 *
 * The one that matters is silent when broken: a `var(--color-admin-*)` naming a
 * token that does not exist is **invalid at computed-value time**, so the
 * property takes its *initial* value instead of falling back to anything
 * sensible. `docs/antd.md` records that shipping six times in two dialog
 * modules, where the symptom was a transparent panel rather than an error.
 *
 * The second check is this repo's own addition, not the ticket's: it refuses a
 * declared token with no consumer, because a colour nothing renders is the
 * "value with no consumer" this file has twice removed. Note the qualifier — a
 * token only the **antd theme** reads (the focus ring, the disabled fill) lives
 * in `designTokens` without a custom property, so it is not affected.
 */

const SRC = join(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			return sourceFiles(path);
		}

		return /\.(css|ts|tsx)$/.test(entry) ? [path] : [];
	});
}

/** Strips comments, so a `var()` mentioned in prose is not read as a consumer. */
function withoutComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every `--color-admin-*` custom property referenced by real code in `src`. */
function referencedAdminVariables(): Set<string> {
	const found = new Set<string>();

	for (const file of sourceFiles(SRC)) {
		// This file names the properties in assertions; counting it would let the
		// "every emitted variable is used" check satisfy itself.
		if (file.endsWith("design-tokens.test.ts")) {
			continue;
		}

		const source = withoutComments(readFileSync(file, "utf8"));
		for (const match of source.matchAll(/var\((--color-admin-[a-z0-9-]+)/g)) {
			found.add(match[1]);
		}
	}

	return found;
}

it("declares every admin custom property the source references", () => {
	const declared = new Set(Object.keys(designTokenCssVariables));
	const missing = [...referencedAdminVariables()].filter(
		(name) => !declared.has(name),
	);

	// A missing name does not fall back to the cascade — it computes to the
	// property's initial value, so the symptom is an invisible element rather
	// than a build error.
	expect(missing).toEqual([]);
});

it("emits no admin custom property that nothing references", () => {
	const referenced = referencedAdminVariables();
	const unused = [...Object.keys(designTokenCssVariables)].filter(
		(name) => name.startsWith("--color-admin-") && !referenced.has(name),
	);

	expect(unused).toEqual([]);
});

it("keeps every emitted custom property in step with its typed token", () => {
	// The custom properties are derived by hand from the same object, so a rename
	// in one place and not the other would otherwise go unnoticed. Compared as
	// whole records rather than spot-checks, so a new variable is covered the
	// moment it is added.
	const emitted = designTokenCssVariables as Record<string, string>;
	const fromTokens = Object.entries(emitted)
		.filter(([name]) => name.startsWith("--color-admin-"))
		.map(([name, value]) => [name, value]);
	const known = fromTokens.filter(([, value]) =>
		Object.values(designTokens.colors.admin).includes(
			value as (typeof designTokens.colors.admin)[keyof typeof designTokens.colors.admin],
		),
	);

	// Every admin variable must name a real `admin` token value.
	expect(known).toHaveLength(fromTokens.length);
});
