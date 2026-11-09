import type { ProductStatus } from "@/types";

import { FILTERABLE_PRODUCT_STATUSES } from "./product-status";
import type { AdminProductSort } from "../api/products.api";

/**
 * The listing's URL state: the single place filter values become safe to send.
 *
 * Everything the user can put in the URL is untrusted. The backend answers 400
 * for an unknown `status`/`sort` enum value, and silently ignores a parameter
 * it does not recognise — so a typo or an edited URL would either break the
 * page or, worse, return an unfiltered page that looks filtered. Every field is
 * therefore validated here and degrades to its default.
 */

/** Page size the listing requests; also the value the footer counts by. */
export const LISTING_PAGE_SIZE = 20;

/** Max characters accepted for the keyword before it is discarded. */
const MAX_KEYWORD_LENGTH = 100;

/** Upper clamp on the page index, to keep absurd URLs out of API calls. */
const MAX_PAGE = 10_000;

export interface ListingQuery {
	/** Case-insensitive substring of the product name (the API has no SKU search). */
	keyword: string | undefined;
	/** Never undefined: the API has no "all statuses" query, so one is always chosen. */
	status: ProductStatus;
	/** Category id; the backend expands it to its whole subtree. */
	category: string | undefined;
	sort: AdminProductSort;
	/** 1-based, because the URL is what a user reads. Converted on send. */
	page: number;
}

export const DEFAULT_LISTING_QUERY: ListingQuery = {
	keyword: undefined,
	status: "ACTIVE",
	category: undefined,
	sort: "NEWEST",
	page: 1,
};

const SORTS: readonly AdminProductSort[] = ["NEWEST", "PRICE_ASC", "PRICE_DESC"];

/** Next gives a repeated query param as an array; take the first value. */
function firstValue(value: unknown): string {
	if (Array.isArray(value)) {
		return String(value[0] ?? "");
	}

	return value == null ? "" : String(value);
}

function parseStatus(value: unknown): ProductStatus {
	const candidate = firstValue(value).toUpperCase();

	return (FILTERABLE_PRODUCT_STATUSES as readonly string[]).includes(candidate)
		? (candidate as ProductStatus)
		: DEFAULT_LISTING_QUERY.status;
}

function parseSort(value: unknown): AdminProductSort {
	const candidate = firstValue(value).toUpperCase();

	return (SORTS as readonly string[]).includes(candidate)
		? (candidate as AdminProductSort)
		: DEFAULT_LISTING_QUERY.sort;
}

function parseKeyword(value: unknown): string | undefined {
	const candidate = firstValue(value).trim();

	return candidate === "" || candidate.length > MAX_KEYWORD_LENGTH
		? undefined
		: candidate;
}

function parseCategory(value: unknown): string | undefined {
	const candidate = firstValue(value).trim();

	return candidate === "" || candidate.length > MAX_KEYWORD_LENGTH
		? undefined
		: candidate;
}

function parsePage(value: unknown): number {
	const parsed = Number(firstValue(value));

	if (!Number.isInteger(parsed)) {
		return 1;
	}

	return Math.min(Math.max(parsed, 1), MAX_PAGE);
}

/**
 * Parses untrusted search params into a listing query. Cannot fail: every field
 * falls back to its default, so a hand-edited URL renders the default page
 * rather than an error.
 */
export function parseListingQuery(
	params: Record<string, unknown>,
): ListingQuery {
	return {
		keyword: parseKeyword(params.keyword),
		status: parseStatus(params.status),
		category: parseCategory(params.category),
		sort: parseSort(params.sort),
		page: parsePage(params.page),
	};
}

/**
 * Builds the router query from a listing query, omitting defaults so the
 * unfiltered view keeps the bare `/admin/products` URL.
 */
export function toListingSearchParams(
	query: ListingQuery,
): Record<string, string> {
	const params: Record<string, string> = {};

	if (query.keyword) {
		params.keyword = query.keyword;
	}

	if (query.status !== DEFAULT_LISTING_QUERY.status) {
		params.status = query.status;
	}

	if (query.category) {
		params.category = query.category;
	}

	if (query.sort !== DEFAULT_LISTING_QUERY.sort) {
		params.sort = query.sort;
	}

	if (query.page > 1) {
		params.page = String(query.page);
	}

	return params;
}

/** The listing href, for links and `router.push`. */
export function toListingHref(query: ListingQuery): string {
	const search = new URLSearchParams(toListingSearchParams(query)).toString();

	return search ? `/admin/products?${search}` : "/admin/products";
}

/**
 * Converts the URL's 1-based page to the API's 0-based index.
 *
 * Kept separate from the query type so no caller has to remember which
 * convention it is holding; passing the URL page straight to `listProducts`
 * would silently skip the first page.
 */
export function toApiPage(page: number): number {
	return Math.max(page - 1, 0);
}
