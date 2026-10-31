#!/usr/bin/env node
/**
 * Fails when a `styles.x` reference has no matching class in the imported CSS module.
 *
 * A dangling reference renders `class="undefined"` at runtime and neither `tsc` nor
 * ESLint can see into a CSS module, so this is the only guard for it.
 *
 * Covers: named class selectors (`.foo`), `composes: foo` / `composes: foo from` (the
 * composed name counts as defined), and `@value` declarations.
 *
 * Usage: node scripts/check-css-modules.mjs [rootDir]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(process.argv[2] ?? "src");
const SOURCE_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const IMPORT_RE = /import\s+(?:\*\s+as\s+)?(\w+)\s+from\s+["']([^"']+\.module\.css)["']/g;
const REF_RE = /(?<![\w$])(\w+)\.([A-Za-z_$][\w$]*)/g;

/** Walk the tree, skipping node_modules and dot-directories. */
function* walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
			yield* walk(full);
		} else {
			yield full;
		}
	}
}

/** Every name a module exports: class selectors, composed names, @value declarations. */
function definedNames(cssPath) {
	const css = fs.readFileSync(cssPath, "utf8");
	const names = new Set();

	for (const match of css.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) names.add(match[1]);
	for (const match of css.matchAll(/@value\s+([\w-]+)/g)) names.add(match[1]);
	for (const match of css.matchAll(/composes\s*:\s*([^;]+)/g)) {
		const [local] = match[1].split(/\s+from\s+/);
		for (const name of local.split(/\s+/)) if (name) names.add(name);
	}

	return names;
}

const definedCache = new Map();
const failures = [];
let files = 0;

for (const file of walk(ROOT)) {
	if (!SOURCE_EXTENSIONS.has(path.extname(file))) continue;
	files += 1;

	const source = fs.readFileSync(file, "utf8");
	for (const [, binding, cssRelative] of source.matchAll(IMPORT_RE)) {
		const cssPath = path.resolve(path.dirname(file), cssRelative);
		if (!fs.existsSync(cssPath)) {
			failures.push({ file, name: `${cssRelative} (module not found)` });
			continue;
		}

		if (!definedCache.has(cssPath)) definedCache.set(cssPath, definedNames(cssPath));
		const defined = definedCache.get(cssPath);

		for (const [, refBinding, refName] of source.matchAll(REF_RE)) {
			if (refBinding !== binding) continue;
			if (!defined.has(refName)) failures.push({ file, name: refName });
		}
	}
}

if (failures.length === 0) {
	console.log(`check-css-modules: ${files} source files, no undefined module classes.`);
	process.exit(0);
}

console.error(`check-css-modules: ${failures.length} undefined module class reference(s):`);
for (const { file, name } of failures) {
	console.error(`  ${path.relative(process.cwd(), file)}  ->  styles.${name}`);
}
process.exit(1);
