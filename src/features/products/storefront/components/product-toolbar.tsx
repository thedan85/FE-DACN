"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";

import { toSearchPath, type ProductListQuery } from "../model/product-search-params";
import { resolveSort, SORT_OPTIONS } from "../model/product-sort";
import styles from "./product-toolbar.module.css";

import { useMobile } from "@/hooks/use-mobile";

type ProductToolbarProps = {
	/** Current (validated) URL state; navigation rewrites it via the router. */
	query: ProductListQuery;
};

/**
 * Search + sort controls for the listing (URL is the single source of truth:
 * any committed change resets `page` back to 1). Search is antd
 * `Input.Search` with an icon `enterButton` — clickable and Enter-triggered.
 */
export function ProductToolbar({ query }: ProductToolbarProps) {
	const router = useRouter();
	const [searchValue, setSearchValue] = useState(query.name ?? "");
	const [lastUrlName, setLastUrlName] = useState(query.name);

	// Keep the input in sync when the URL changes from outside
	// (category links, clear-search, back/forward navigation).
	// Guarded render adjustment — no effect needed (react.dev "You might not
	// need an Effect: Adjusting state when a prop changes").
	if (lastUrlName !== query.name) {
		setLastUrlName(query.name);
		setSearchValue(query.name ?? "");
	}

	const apply = (changes: Partial<ProductListQuery>) => {
		void router.replace(
			toSearchPath({ ...query, ...changes, page: 1 }),
			{ scroll: false },
		);
	};

	const isMobile = useMobile();

	return (
		<div className={styles.toolbar} style={{ flexWrap: isMobile ? "wrap" : "nowrap" }}>
			<Input.Search
				className={styles.search}
				allowClear
				placeholder="Search products..."
				aria-label="Search products by name"
				value={searchValue}
				onChange={(event) => {
					const next = event.target.value;
					setSearchValue(next);

					// Clearing the field immediately clears the filter.
					if (next === "") {
						apply({ name: undefined });
					}
				}}
				onSearch={(value) => apply({ name: value.trim() || undefined })}
				enterButton={
					<Button
						type="primary"
						icon={<SearchOutlined />}
						aria-label="Search"
					/>
				}
			/>

			<Select
				aria-label="Sort products"
				className={styles.sort}
				value={query.sort}
				options={SORT_OPTIONS.map((option) => ({
					value: option.value,
					label: option.label,
				}))}
				onChange={(value) => apply({ sort: resolveSort(value) })}
			/>
		</div>
	);
}
