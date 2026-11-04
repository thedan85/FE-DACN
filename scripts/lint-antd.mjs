#!/usr/bin/env node
/**
 * Runs the pinned `@ant-design/cli` lint and fails the gate when it reports
 * anything.
 *
 * The CLI exits 0 whether it finds nothing or three deprecated props (verified
 * on 6.6.8: `antd lint src` printed "Found 3 issues" and exited 0), so its exit
 * code cannot gate anything on its own. The counts are parsed out of its summary
 * instead, and an unreadable result is a failure rather than a pass — a CLI
 * upgrade that changes that wording must be loud, not silent.
 *
 * `antd lint` catches a class nothing else does: v6 renamed `Alert.message` to
 * `title`, `List` to `Listy`, and deprecated `Select.optionFilterProp`, and
 * `tsc`, ESLint and the test suite all accept the old props happily.
 *
 * Usage: node scripts/lint-antd.mjs [targets...]   (default: src)
 *        node scripts/lint-antd.mjs --staged      (only staged files)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const CLI = "node_modules/@ant-design/cli/dist/index.js";
const targets = process.argv.slice(2);
const args = ["lint", ...(targets.length ? targets : ["src"])];

if (!fs.existsSync(CLI)) {
	console.error(`lint-antd: ${CLI} is missing. Run npm install.`);
	process.exit(1);
}

// Spawning node on the CLI's entry, rather than the `antd` shim, keeps this the
// same call on Windows and POSIX and needs no shell.
const result = spawnSync(process.execPath, [CLI, ...args], {
	encoding: "utf8",
	shell: false,
});

if (result.error) {
	console.error(`lint-antd: could not run the CLI: ${result.error.message}`);
	process.exit(1);
}

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

if (result.status !== 0) {
	console.error(output.trim());
	console.error(`lint-antd: the CLI exited ${result.status}.`);
	process.exit(1);
}

const scanned = /Scanned (?<count>\d+) files?/.exec(output)?.groups?.count;
const clean = /No issues found\./.test(output);
const summary = /Summary:\s*(?<summary>.+)/.exec(output)?.groups?.summary;

if (!clean && !summary) {
	// Neither shape matched: the command ran but said nothing this script
	// understands. Treating that as a pass would hide a renamed output format.
	console.error(output.trim());
	console.error("lint-antd: could not read a result from the CLI output.");
	process.exit(1);
}

const findings = [...(summary ?? "").matchAll(/(?<count>\d+) (?<kind>deprecated|a11y|usage|performance)/g)]
	.map((match) => Number(match.groups.count))
	.reduce((total, count) => total + count, 0);

if (clean || findings === 0) {
	console.log(`lint-antd: ${scanned ?? "?"} files, no deprecated or discouraged antd usage.`);
	process.exit(0);
}

console.error(output.trim());
console.error("");
console.error(`lint-antd: ${findings} finding(s). Run \`antd info <Component>\` for the current prop.`);
process.exit(1);
