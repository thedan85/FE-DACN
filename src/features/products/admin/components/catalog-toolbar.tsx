"use client";

import { useState } from "react";
import { Button, Drawer, Input, Select } from "antd";
import { FilterOutlined, SearchOutlined } from "@ant-design/icons";

import type { Category } from "../../types";
import {
	FILTERABLE_PRODUCT_STATUSES,
	productStatusLabel,
} from "../model/product-status";
import type { ListingQuery } from "../model/listing-query";
import type { AdminProductSort } from "../api/products.api";
import styles from "./catalog-toolbar.module.css";

type CatalogToolbarProps = {
	query: ListingQuery;
	/** Fires on every change; the page owns URL synchronisation. */
	onChange: (next: Partial<ListingQuery>) => void;
	categories: Category[];
	categoriesLoading: boolean;
	/** The keyword is committed on submit rather than per keystroke. */
	onKeywordSubmit: (keyword: string) => void;
};

const SORT_OPTIONS: { value: AdminProductSort; label: string }[] = [
	{ value: "NEWEST", label: "Newest" },
	{ value: "PRICE_ASC", label: "Price: low to high" },
	{ value: "PRICE_DESC", label: "Price: high to low" },
];

/**
 * Search, category, status and sort controls.
 *
 * The search box is a form: submitting it changes the URL, so a half-typed word
 * never becomes a request and typing does not chatter at the API. The selects
 * apply immediately, because picking a value is already a commitment.
 *
 * Below `md` the three selects move into a drawer and only search stays in the
 * bar, per the design's mobile frame.
 */
export function CatalogToolbar({
	query,
	onChange,
	categories,
	categoriesLoading,
	onKeywordSubmit,
}: CatalogToolbarProps) {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [keywordDraft, setKeywordDraft] = useState(query.keyword ?? "");

	// The URL is the source of truth for the committed keyword, so the box must
	// follow it: "Clear filters", a back button, or a pasted link would otherwise
	// leave the old text in the input and re-apply a filter the URL had dropped.
	// Adjusted during render (React's documented pattern) rather than in an
	// effect, so the input never paints one frame of stale text.
	const [syncedKeyword, setSyncedKeyword] = useState(query.keyword ?? "");

	if (syncedKeyword !== (query.keyword ?? "")) {
		setSyncedKeyword(query.keyword ?? "");
		setKeywordDraft(query.keyword ?? "");
	}

	const categoryOptions = [
		{ value: "", label: "All categories" },
		...categories.map((category) => ({
			value: category.categoryId,
			label: category.name,
		})),
	];

	const statusOptions = FILTERABLE_PRODUCT_STATUSES.map((status) => ({
		value: status,
		label: productStatusLabel(status),
	}));

	const filters = (
		<>
			<Select
				className={styles.select}
				aria-label="Filter by category"
				value={query.category ?? ""}
				options={categoryOptions}
				loading={categoriesLoading}
				// v6 moved the filter prop onto `showSearch`; passing
				// `optionFilterProp` directly is deprecated.
				showSearch={{ optionFilterProp: "label" }}
				onChange={(value) => onChange({ category: value || undefined, page: 1 })}
			/>
			<Select
				className={styles.select}
				aria-label="Filter by status"
				value={query.status}
				options={statusOptions}
				onChange={(value) => onChange({ status: value, page: 1 })}
			/>
			<Select
				className={styles.select}
				aria-label="Sort products"
				value={query.sort}
				options={SORT_OPTIONS}
				onChange={(value) => onChange({ sort: value, page: 1 })}
			/>
		</>
	);

	return (
		<div className={styles.toolbar}>
			<form
				className={styles.searchForm}
				role="search"
				onSubmit={(event) => {
					event.preventDefault();
					onKeywordSubmit(keywordDraft.trim());
				}}
			>
				<Input
					className={styles.search}
					aria-label="Search products by name"
					prefix={<SearchOutlined />}
					placeholder="Search by product name…"
					value={keywordDraft}
					allowClear
					onChange={(event) => {
						setKeywordDraft(event.target.value);
						// Clearing via the built-in control is an explicit reset, so it
						// applies immediately instead of waiting for a submit.
						if (event.target.value === "") {
							onKeywordSubmit("");
						}
					}}
				/>
			</form>

			<div className={styles.desktopFilters}>{filters}</div>

			<Button
				className={styles.mobileFilterButton}
				icon={<FilterOutlined />}
				onClick={() => setDrawerOpen(true)}
			>
				Filters
			</Button>

			<Drawer
				title="Filters"
				placement="bottom"
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				size="auto"
			>
				<div className={styles.drawerFilters}>{filters}</div>
			</Drawer>
		</div>
	);
}
