import { z } from "zod";

import {
	DEFAULT_SORT,
	resolveSort,
	type SortValue,
} from "./product-sort";

/**
 * Storefront URL state for `/products` (D5/D9/D11):
 *
 *   ?name=…&category=…&sort=…&min_price=…&max_price=…&page=…
 *
 * `name` maps to the backend `keyword` param, `category` maps to
 * `category_id`, `min_price`/`max_price` map 1:1 (D11 — the backend
 * answers **400 for non-numeric values**, so raw input must never leak),
 * `sort` maps to the `ProductSort` enum. Values are always
 * validated/clamped here so raw user input never reaches the backend
 * (which answers 400/500 for invalid enums and sort fields).
 */

export const PRODUCTS_PAGE_SIZE = 12;

/** Max length accepted for `name` and `category` before being discarded. */
const MAX_QUERY_LENGTH = 100;

/** Upper clamp for `page` to keep absurd values out of API calls. */
const MAX_PAGE = 10_000;

/** Upper sanity bound for price inputs (VND; keeps absurd values out). */
const MAX_PRICE = 1_000_000_000;

export interface ProductListQuery {
	/** Local search term; maps to the API `keyword` param. */
	name?: string | undefined;
	/** Category slug; maps to the API `category_id` param. */
	category?: string | undefined;
	sort: SortValue;
	/** Inclusive lower bound on the lowest active variant price (D11). */
	minPrice?: number | undefined;
	/** Inclusive upper bound on the lowest active variant price (D11). */
	maxPrice?: number | undefined;
	/** 1-based page number (backend pages are 0-based). */
	page: number;
}

const singleValue = z
	.union([z.string(), z.array(z.string())])
	.optional()
	.transform((value) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? "")));

const nameField = singleValue
	.transform((value) => value.trim() || undefined)
	.pipe(z.string().max(MAX_QUERY_LENGTH).optional())
	.catch(undefined);

const categoryField = singleValue
	.transform((value) => value.trim() || undefined)
	.pipe(z.string().max(MAX_QUERY_LENGTH).optional())
	.catch(undefined);

const sortField = singleValue
	.transform((value) => resolveSort(value))
	.catch(DEFAULT_SORT);

const pageField = singleValue
	.transform((value) => {
		const parsed = Number(value);
		return Number.isInteger(parsed)
			? Math.min(Math.max(parsed, 1), MAX_PAGE)
			: 1;
	})
	.catch(1);

const priceField = singleValue
	.transform((value) => {
		if (!value) {
			return undefined;
		}

		const parsed = Number(value);
		return Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_PRICE
			? parsed
			: undefined;
	})
	.catch(undefined);

const searchParamsSchema = z.object({
	name: nameField,
	category: categoryField,
	sort: sortField,
	page: pageField,
	min_price: priceField,
	max_price: priceField,
});

/**
 * Parses untrusted `searchParams` into a safe listing query.
 * Every field degrades to a valid default; the schema cannot fail wholesale.
 */
export function parseProductSearchParams(
	rawSearchParams: unknown,
): ProductListQuery {
	const result = searchParamsSchema.safeParse(rawSearchParams);

	if (!result.success) {
		return {
			name: undefined,
			category: undefined,
			sort: DEFAULT_SORT,
			page: 1,
		};
	}

	const { min_price: minPrice, max_price: maxPrice, ...rest } = result.data;

	// Normalize an inverted range (min > max) by swapping instead of
	// silently returning an empty result set.
	const [min, max] =
		minPrice != null && maxPrice != null && minPrice > maxPrice
			? [maxPrice, minPrice]
			: [minPrice, maxPrice];

	// The schema guarantees valid, whitelisted values for every field.
	return { ...rest, minPrice: min, maxPrice: max };
}

/**
 * Builds the Next.js `router` query object from a listing query,
 * omitting default values to keep URLs clean and shareable.
 */
export function toSearchQueryString(
	query: ProductListQuery,
): Record<string, string> {
	const params: Record<string, string> = {};

	if (query.name) {
		params.name = query.name;
	}

	if (query.category) {
		params.category = query.category;
	}

	if (query.sort !== DEFAULT_SORT) {
		params.sort = query.sort;
	}

	if (query.minPrice != null) {
		params.min_price = String(query.minPrice);
	}

	if (query.maxPrice != null) {
		params.max_price = String(query.maxPrice);
	}

	if (query.page > 1) {
		params.page = String(query.page);
	}

	return params;
}

/**
 * Builds the `/products` href (including the query string) for links and
 * `router` navigation — App Router navigation takes a string href.
 */
export function toSearchPath(query: ProductListQuery): string {
	const search = new URLSearchParams(toSearchQueryString(query)).toString();
	return search ? `/products?${search}` : "/products";
}
