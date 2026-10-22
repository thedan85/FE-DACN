import type { Category } from "../../types";

/**
 * Pure helpers over the flat category list from `GET /api/v1/categories`
 * (hierarchical; roots have `parentCategoryId: null`, `slug === categoryId`).
 */

export interface CategoryNode {
	category: Category;
	children: CategoryNode[];
}

function sortByName(a: Category, b: Category): number {
	return a.name.localeCompare(b.name);
}

/** Builds an alphabetically sorted category tree from the flat list. */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
	const nodes = new Map<string, CategoryNode>();

	for (const category of categories) {
		nodes.set(category.categoryId, { category, children: [] });
	}

	const roots: CategoryNode[] = [];

	for (const node of nodes.values()) {
		const parentId = node.category.parentCategoryId;
		const parent = parentId ? nodes.get(parentId) : undefined;

		if (parent) {
			parent.children.push(node);
		} else {
			roots.push(node);
		}
	}

	const sortNodes = (list: CategoryNode[]): CategoryNode[] => {
		list.sort((a, b) => sortByName(a.category, b.category));
		for (const node of list) {
			sortNodes(node.children);
		}
		return list;
	};

	return sortNodes(roots);
}

/** Finds a category by its slug (backend slugs equal category ids). */
export function findCategoryBySlug(
	categories: Category[],
	slug: string,
): Category | undefined {
	return (
		categories.find(
			(category) => category.slug === slug || category.categoryId === slug,
		) ?? undefined
	);
}

/** Returns the direct children of a category (used for empty-state links). */
export function getChildCategories(
	categories: Category[],
	parentCategoryId: string,
): Category[] {
	return categories
		.filter((category) => category.parentCategoryId === parentCategoryId)
		.sort(sortByName);
}

/**
 * Returns the chain from the root down to (and including) the given
 * category — used to expand tree nodes so the selection is visible, and
 * later for detail-page breadcrumbs.
 */
export function getAncestorChain(
	categories: Category[],
	categoryId: string,
): Category[] {
	const byId = new Map(
		categories.map((category) => [category.categoryId, category]),
	);

	const chain: Category[] = [];
	const visited = new Set<string>();
	let current = byId.get(categoryId);

	while (current && !visited.has(current.categoryId)) {
		visited.add(current.categoryId);
		chain.unshift(current);
		current = current.parentCategoryId
			? byId.get(current.parentCategoryId)
			: undefined;
	}

	return chain;
}
