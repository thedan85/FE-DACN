import type { Category } from "../../types";

/**
 * Pure helpers over the flat category list.
 *
 * The backend's page order carries no hierarchy meaning, so the client
 * sorts by name and rebuilds the tree itself. Every walk here uses a visited
 * set: the data can carry legacy or malformed parent links (self-parents,
 * two-node cycles), and no helper may loop on them.
 */

function compareCategoriesByName(a: Category, b: Category): number {
	return a.name.localeCompare(b.name) || a.categoryId.localeCompare(b.categoryId);
}

/**
 * Groups categories by their parent's id. Edges into an id absent from the
 * list are ignored: they cannot anchor a cycle inside this data set, and a
 * category whose parent is missing is promoted to a root elsewhere.
 */
function groupChildren(
	categories: readonly Category[],
): Map<string, Category[]> {
	const present = new Set(categories.map((category) => category.categoryId));
	const childrenById = new Map<string, Category[]>();

	for (const category of categories) {
		const parentId = category.parentCategoryId;

		if (!parentId || !present.has(parentId)) {
			continue;
		}

		const siblings = childrenById.get(parentId) ?? [];
		siblings.push(category);
		childrenById.set(parentId, siblings);
	}

	return childrenById;
}

/**
 * The parents a category may be moved under: everything except the category
 * itself, anything descending from it, and any category whose ancestor chain
 * never reaches a root — i.e. legacy self-parents and cycles.
 *
 * All exclusions come from walking each candidate's parent chain, which
 * terminates on a visited set:
 *
 * - reaching `categoryId` means the candidate is a descendant of the node
 *   being moved (choosing it would close a cycle), and
 * - revisiting a node means the candidate's chain is cyclic legacy data,
 *   which the server's upward cycle check would walk forever.
 *
 * A chain that ends at a root, or at an id absent from the list (a
 * soft-deleted parent), is safe. An id absent from the list as `categoryId`
 * excludes no descendants, which is the create case. Results are sorted by
 * name.
 */
export function eligibleCategoryParents(
	categories: readonly Category[],
	categoryId: string,
): Category[] {
	const byId = new Map(
		categories.map((category) => [category.categoryId, category]),
	);
	const excluded = new Set<string>([categoryId]);

	for (const candidate of categories) {
		if (excluded.has(candidate.categoryId)) {
			continue;
		}

		// Walk the ancestor chain upward. Reaching `categoryId` makes the
		// candidate a descendant; revisiting a node makes its chain cyclic.
		const seen = new Set<string>([candidate.categoryId]);
		let current = candidate;

		while (current.parentCategoryId) {
			const parentId = current.parentCategoryId;

			if (parentId === categoryId || seen.has(parentId)) {
				excluded.add(candidate.categoryId);
				break;
			}

			seen.add(parentId);
			const parent = byId.get(parentId);

			if (!parent) {
				// Chain ends at a soft-deleted or unknown parent: safe.
				break;
			}

			current = parent;
		}
	}

	return categories
		.filter((category) => !excluded.has(category.categoryId))
		.sort(compareCategoriesByName);
}

export interface FlatCategory {
	category: Category;
	/** Depth below the root, for indentation. Roots are depth 0. */
	depth: number;
}

/**
 * The flat, display-ready list: depth-first from the roots, siblings sorted
 * by name at every level.
 *
 * A category whose parent is absent from the list (a soft-deleted parent) is
 * promoted to a root so it stays visible. A cyclic component never reaches a
 * root; its members are appended once visited-set traversal finishes the
 * rest of the list, so nothing disappears either.
 */
export function flattenCategoryHierarchy(
	categories: readonly Category[],
): FlatCategory[] {
	const byId = new Map(
		categories.map((category) => [category.categoryId, category]),
	);
	const childrenById = groupChildren(categories);

	for (const siblings of childrenById.values()) {
		siblings.sort(compareCategoriesByName);
	}

	const roots = categories
		.filter(
			(category) =>
				!category.parentCategoryId ||
				!byId.has(category.parentCategoryId),
		)
		.sort(compareCategoriesByName);

	const result: FlatCategory[] = [];
	const visited = new Set<string>();

	const walk = (seed: Category, depth: number) => {
		const stack: FlatCategory[] = [{ category: seed, depth }];

		while (stack.length > 0) {
			const current = stack.pop();

			if (!current || visited.has(current.category.categoryId)) {
				continue;
			}

			visited.add(current.category.categoryId);
			result.push(current);

			const children = childrenById.get(current.category.categoryId) ?? [];

			for (let index = children.length - 1; index >= 0; index -= 1) {
				stack.push({ category: children[index], depth: current.depth + 1 });
			}
		}
	};

	for (const root of roots) {
		walk(root, 0);
	}

	// Anything still unvisited belongs to a cyclic component with no root;
	// keep it visible instead of dropping it from the table.
	for (const category of [...categories].sort(compareCategoriesByName)) {
		if (!visited.has(category.categoryId)) {
			walk(category, 0);
		}
	}

	return result;
}
