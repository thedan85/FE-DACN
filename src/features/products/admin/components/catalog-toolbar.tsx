"use client";

import { useId, useState } from "react";
import { Button, Input, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";

import type { Category } from "../../types";
import {
	FILTERABLE_PRODUCT_STATUSES,
	productStatusLabel,
} from "../model/product-status";
import { DEFAULT_LISTING_QUERY, type ListingQuery } from "../model/listing-query";
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
 */
export function CatalogToolbar({
	query,
	onChange,
	categories,
	categoriesLoading,
	onKeywordSubmit,
}: CatalogToolbarProps) {
	const fieldId = useId();
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

	const canReset =
		Boolean(keywordDraft || query.keyword || query.category) ||
		query.status !== DEFAULT_LISTING_QUERY.status ||
		query.sort !== DEFAULT_LISTING_QUERY.sort;

	return (
		<div className={styles.toolbar}>
			<form
				className={`${styles.field} ${styles.searchForm}`}
				role="search"
				onSubmit={(event) => {
					event.preventDefault();
					onKeywordSubmit(keywordDraft.trim());
				}}
			>
				<label htmlFor={`${fieldId}-search`}>Product name</label>
				<Input
					id={`${fieldId}-search`}
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

			<div className={styles.field}>
				<label htmlFor={`${fieldId}-category`}>Category</label>
				<Select
					id={`${fieldId}-category`}
					className={styles.select}
					value={query.category ?? ""}
					options={categoryOptions}
					loading={categoriesLoading}
					// v6 moved the filter prop onto `showSearch`; passing
					// `optionFilterProp` directly is deprecated.
					showSearch={{ optionFilterProp: "label" }}
					onChange={(value) => onChange({ category: value || undefined, page: 1 })}
				/>
			</div>
			<div className={styles.field}>
				<label htmlFor={`${fieldId}-status`}>Status</label>
				<Select
					id={`${fieldId}-status`}
					className={styles.select}
					value={query.status}
					options={statusOptions}
					onChange={(value) => onChange({ status: value, page: 1 })}
				/>
			</div>
			<div className={styles.field}>
				<label htmlFor={`${fieldId}-sort`}>Sort</label>
				<Select
					id={`${fieldId}-sort`}
					className={styles.select}
					value={query.sort}
					options={SORT_OPTIONS}
					onChange={(value) => onChange({ sort: value, page: 1 })}
				/>
			</div>

			<Button
				className={styles.reset}
				disabled={!canReset}
				onClick={() => {
					setKeywordDraft("");
					onChange(DEFAULT_LISTING_QUERY);
				}}
			>
				Reset filters
			</Button>
		</div>
	);
}
