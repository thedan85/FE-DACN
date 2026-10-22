/**
 * Sort options exposed in the storefront URL space, mapped to the backend
 * `ProductSort` enum (`GET /api/v1/products?sort=…`, verified 2026-10-22):
 *
 * - NEWEST      — `createdAt DESC` (backend default)
 * - PRICE_ASC   — lowest active variant price ascending
 * - PRICE_DESC  — most expensive variant price descending
 *
 * Invalid values must never reach the backend (it answers 400 for the enum).
 */

export const SORT_VALUES = ["newest", "price_asc", "price_desc"] as const;

export type SortValue = (typeof SORT_VALUES)[number];

export const DEFAULT_SORT: SortValue = "newest";

type SortOption = {
	value: SortValue;
	label: string;
	apiValue: string;
};

export const SORT_OPTIONS: readonly SortOption[] = [
	{ value: "newest", label: "Newest", apiValue: "NEWEST" },
	{ value: "price_asc", label: "Price: low to high", apiValue: "PRICE_ASC" },
	{ value: "price_desc", label: "Price: high to low", apiValue: "PRICE_DESC" },
];

const API_SORT_BY_VALUE: Record<SortValue, string> = {
	newest: "NEWEST",
	price_asc: "PRICE_ASC",
	price_desc: "PRICE_DESC",
};

export function resolveSort(value: unknown): SortValue {
	return (SORT_VALUES as readonly string[]).includes(value as string)
		? (value as SortValue)
		: DEFAULT_SORT;
}

/** Maps a storefront sort value to the `ProductSort` enum value sent to the API. */
export function toApiSort(value: SortValue): string {
	return API_SORT_BY_VALUE[value];
}
