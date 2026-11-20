import { expect, it } from "vitest";

import {
	eligibleCategoryParents,
	flattenCategoryHierarchy,
} from "./category-hierarchy";
import type { Category } from "../../types";

function category(
	categoryId: string,
	name: string,
	parentCategoryId: string | null,
): Category {
	return {
		categoryId,
		name,
		slug: categoryId.toLowerCase(),
		parentCategoryId,
		deleted: false,
		createdAt: "2026-11-01T00:00:00Z",
		updatedAt: "2026-11-01T00:00:00Z",
	};
}

/**
 * The contract for the tree helpers: the API's page order carries no
 * hierarchy meaning, so the client sorts and flattens itself, and every
 * walk terminates even on legacy data whose parent links form a cycle.
 */

it("categoryParentChoices_excludeDescendantsAcrossPages", () => {
	// ROOT arrives on page zero; its descendant arrives on page one. Choosing
	// a parent for ROOT must not offer DESC even though the two never share
	// a page — walking only one page would allow the cycle ROOT -> DESC -> ROOT.
	const rows = [
		category("ROOT", "Root category", null),
		category("OTHER", "Other category", null),
		category("DESC", "Descendant", "ROOT"),
	];

	expect(
		eligibleCategoryParents(rows, "ROOT").map((row) => row.categoryId),
	).toEqual(["OTHER"]);
});

it("categoryParentChoices_terminatesOnCyclicLegacyChain", () => {
	// A <-> B is a legacy cycle and SELF is a self-parent: both walks must
	// terminate rather than loop forever, and neither cyclic member may be
	// offered as a parent of A or SELF.
	const rows = [
		category("A", "Alpha", "B"),
		category("B", "Beta", "A"),
		category("SELF", "Self parent", "SELF"),
		category("OTHER", "Other category", null),
	];

	const forA = eligibleCategoryParents(rows, "A").map((row) => row.categoryId);
	expect(forA).toEqual(["OTHER"]);
	expect(forA).not.toContain("B");

	const forSelf = eligibleCategoryParents(rows, "SELF").map(
		(row) => row.categoryId,
	);
	expect(forSelf).not.toContain("SELF");
	expect(forSelf).toContain("OTHER");
});

it("eligibleCategoryParents returns the candidates sorted by name", () => {
	const rows = [
		category("C2", "Bravo", null),
		category("C1", "Alpha", null),
		category("C3", "Charlie", null),
	];

	expect(
		eligibleCategoryParents(rows, "MISSING").map((row) => row.name),
	).toEqual(["Alpha", "Bravo", "Charlie"]);
});

it("flattenCategoryHierarchy keeps a row whose parent is absent visible", () => {
	// The parent was soft-deleted after this row was assigned to it. Dropping
	// the row would hide live data; treating it as a root keeps it reachable.
	const rows = [
		category("ORPHAN", "Orphan", "GHOST"),
		category("ROOT", "Root category", null),
		category("CHILD", "Child", "ROOT"),
	];

	const flat = flattenCategoryHierarchy(rows);
	// Both CHILD (parent present) and ORPHAN (parent absent) render at their
	// proper depth; siblings are ordered by name at every level, roots
	// included, so the orphan leads the alphabet.
	expect(flat.map((entry) => entry.category.categoryId)).toEqual([
		"ORPHAN",
		"ROOT",
		"CHILD",
	]);
	expect(flat.find((entry) => entry.category.categoryId === "ORPHAN")?.depth).toBe(0);
	expect(flat.find((entry) => entry.category.categoryId === "CHILD")?.depth).toBe(1);
});

it("flattenCategoryHierarchy sorts siblings by name at every level", () => {
	const rows = [
		category("ROOT", "Zulu root", null),
		category("ALPHA", "Alpha child", "ROOT"),
		category("ZEBRA", "Zebra child", "ROOT"),
	];

	expect(
		flattenCategoryHierarchy(rows).map((entry) => entry.category.categoryId),
	).toEqual(["ROOT", "ALPHA", "ZEBRA"]);
});

it("flattenCategoryHierarchy terminates on a cyclic component and keeps it visible", () => {
	// A <-> B never reaches a root, so a naive roots-only walk would render
	// nothing. Every member must still appear exactly once.
	const rows = [
		category("A", "Alpha", "B"),
		category("B", "Beta", "A"),
		category("ROOT", "Root category", null),
	];

	const flat = flattenCategoryHierarchy(rows);
	expect(flat.map((entry) => entry.category.categoryId).sort()).toEqual([
		"A",
		"B",
		"ROOT",
	]);
	expect(flat).toHaveLength(3);
});
