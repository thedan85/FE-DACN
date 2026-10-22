"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Tree } from "antd";

import type { Category } from "../../types";
import {
	buildCategoryTree,
	findCategoryBySlug,
	getAncestorChain,
	type CategoryNode,
} from "../model/category-tree";
import { toSearchPath, type ProductListQuery } from "../model/product-search-params";
import { ProductPriceFilter } from "./product-price-filter";
import styles from "./product-sidebar.module.css";

type ProductSidebarProps = {
	categories: Category[];
	query: ProductListQuery;
};

/** Structural subset of antd's `DataNode` (key = category slug). */
type CategoryTreeData = {
	key: string;
	title: string;
	children?: CategoryTreeData[];
};

function toTreeData(nodes: CategoryNode[]): CategoryTreeData[] {
	return nodes.map(({ category, children }) => ({
		key: category.slug,
		title: category.name,
		// Empty `children` would render an expandable-but-empty node.
		children: children.length > 0 ? toTreeData(children) : undefined,
	}));
}

/**
 * Category filter (single-select) for the listing, built on antd `Tree`
 * (`checkable` + `checkStrictly`): checking a node selects it, unchecking
 * the checked node clears the filter — all URL-driven like every other
 * filter, with optimistic local check state so feedback isn't stuck behind
 * the server round-trip.
 */
export function ProductSidebar({ categories, query }: ProductSidebarProps) {
	const router = useRouter();

	const selectedCategory = query.category
		? findCategoryBySlug(categories, query.category)
		: undefined;
	// An unknown slug stays out of the tree (the empty state explains it).
	const selectedKey = selectedCategory?.slug;

	const [checkedKeys, setCheckedKeys] = useState<string[]>(
		selectedKey ? [selectedKey] : [],
	);
	const [expandedKeys, setExpandedKeys] = useState<string[]>(() =>
		selectedKey
			? getAncestorChain(categories, selectedKey).map((c) => c.slug)
			: [],
	);
	const [lastUrlCategory, setLastUrlCategory] = useState(query.category);

	// Re-sync when the URL category changes from outside (toolbar, empty-state
	// links, back/forward). Guarded render adjustment — no effect needed.
	if (lastUrlCategory !== query.category) {
		setLastUrlCategory(query.category);
		setCheckedKeys(selectedKey ? [selectedKey] : []);
		setExpandedKeys(
			selectedKey
				? getAncestorChain(categories, selectedKey).map((c) => c.slug)
				: [],
		);
	}

	const navigate = (changes: Partial<ProductListQuery>) => {
		void router.replace(
			toSearchPath({ ...query, ...changes, page: 1 }),
			{ scroll: false },
		);
	};

	return (
		<div className={styles.sidebar}>
			<h2 className={styles.title}>Category</h2>

			<Button
				block
				type={query.category ? "default" : "primary"}
				onClick={() => {
					setCheckedKeys([]);
					navigate({ category: undefined });
				}}
			>
				All products
			</Button>

			<Tree
				className={styles.tree}
				aria-label="Category filter"
				checkable
				checkStrictly
				selectable={false}
				blockNode
				treeData={toTreeData(buildCategoryTree(categories))}
				checkedKeys={checkedKeys}
				onCheck={(_checkedKeys, event) => {
					const key = String(event.node.key ?? "");
					if (!key) {
						return;
					}

					if (event.checked) {
						setCheckedKeys([key]);
						navigate({ category: key });
					} else {
						// Unchecking the selected node clears the filter.
						setCheckedKeys([]);
						navigate({ category: undefined });
					}
				}}
				expandedKeys={expandedKeys}
				onExpand={(keys) => setExpandedKeys(keys.map(String))}
			/>

			<ProductPriceFilter query={query} />
		</div>
	);
}
