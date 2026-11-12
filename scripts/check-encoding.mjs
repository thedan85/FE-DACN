#!/usr/bin/env node
/**
 * Fails when a text file is not clean UTF-8.
 *
 * Three ways a source file breaks quietly, all invisible to `tsc`, ESLint and
 * the test suite because they read the file as text and never look at the bytes:
 *
 *   1. **A UTF-8 BOM** at the start. Harmless to Node, but it makes the first
 *      line of a `.json` or `.md` misparse in other tools.
 *   2. **Bytes that are not UTF-8 at all.** `readFileSync(path, "utf8")` replaces
 *      them with U+FFFD instead of throwing, so the file "works" while its copy
 *      is silently mangled.
 *   3. **A double-encoded round trip** — UTF-8 read as Windows-1252 and written
 *      back as UTF-8, which turns one em dash into three mojibake glyphs and a
 *      middle dot into two. This is what a PowerShell
 *      `Get-Content -Raw | Set-Content` does on a non-UTF-8 console, and it
 *      shipped twice in this repo: once across nine storefront files, once into
 *      `variants.ts`, with `npm run check` and `npm run build` green both times.
 *
 * The markers below are written as escapes rather than literals on purpose: a
 * literal marker in this file would make the check flag itself.
 *
 * Usage: node scripts/check-encoding.mjs [rootDir...]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOTS = process.argv.slice(2).length
	? process.argv.slice(2)
	: ["src", "scripts", "docs", "e2e", "AGENTS.md", "CODING_STANDARDS.md", "GLOSSARY.md", "README.md"];

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".md", ".json"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".scratch", ".opencode", ".agents", ".claude", ".playwright-cli", "test-results", "playwright-report", "coverage", "out", "build"]);
const SKIP_FILES = new Set(["package-lock.json", "tsconfig.tsbuildinfo"]);

/** UTF-8 read as Windows-1252, written back as UTF-8. */
const MOJIBAKE = [
	// Em dash, curly quotes and bullets: A-circumflex then the 0x80-0x9F range.
	/\u00e2[\u20ac\u02c6]/,
	// Every Latin-1 letter doubled: A-tilde then the byte it swallowed.
	/\u00c3[\u00a0-\u00bf]/,
	// A stray A-circumflex left behind by a degree sign, middle dot or nbsp.
	/\u00c2[\u00a0\u00b0\u00b7]/,
	// A BOM decoded as text instead of stripped: i-diaeresis, guillemet, final byte.
	/\u00ef\u00bb\u00bf/,
	// A byte the decoder already gave up on.
	/\ufffd/,
];

const failures = [];
let files = 0;

function lineOf(text, index) {
	let line = 1;
	for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
	return line;
}

function checkFile(file) {
	const bytes = fs.readFileSync(file);

	if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
		failures.push({ file, detail: "UTF-8 BOM" });
		return;
	}

	let text;
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		failures.push({ file, detail: "not valid UTF-8" });
		return;
	}

	for (const marker of MOJIBAKE) {
		const match = marker.exec(text);
		if (match) {
			failures.push({
				file,
				detail: `mojibake at line ${lineOf(text, match.index)}`,
			});
			return;
		}
	}
}

function* walk(target) {
	const stat = fs.statSync(target);

	if (!stat.isDirectory()) {
		if (!SKIP_FILES.has(path.basename(target)) && EXTENSIONS.has(path.extname(target))) {
			yield target;
		}
		return;
	}

	for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
			yield* walk(path.join(target, entry.name));
			continue;
		}

		if (SKIP_FILES.has(entry.name) || !EXTENSIONS.has(path.extname(entry.name))) continue;
		yield path.join(target, entry.name);
	}
}

for (const root of ROOTS) {
	if (!fs.existsSync(root)) continue;
	for (const file of walk(root)) {
		files += 1;
		checkFile(file);
	}
}

if (failures.length === 0) {
	console.log(`check-encoding: ${files} files, no BOM, no mojibake.`);
	process.exit(0);
}

console.error(`check-encoding: ${failures.length} file(s) are not clean UTF-8:`);
for (const { file, detail } of failures) {
	console.error(`  ${path.relative(process.cwd(), file)}  ->  ${detail}`);
}
console.error("");
console.error("Rewrite the file from its original bytes. Do not round-trip it through");
console.error("Get-Content -Raw | Set-Content: on a non-UTF-8 console that is what corrupts it.");
process.exit(1);
