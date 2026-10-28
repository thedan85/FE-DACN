import { ApiError, apiFetch } from "@/lib/api/client";
import {
	createApiResponseSchema,
	createPageResponseSchema,
} from "@/lib/api/schema";

import {
	CategorySchema,
	ProductDetailSchema,
	ProductSchema,
} from "../schema/catalog.schema";
import type {
	Category,
	CategoryPage,
	ProductDetail,
	ProductPage,
} from "../types";

/**
 * Storefront catalog API (read-only), verified against the live backend
 * (`/api/v1`, controller + DTO refs) on 2026-10-22; the product-detail
 * contract re-verified against backend `dev` @ `f758bae` on 2026-10-26.
 *
 * All requests go through `apiFetch`; payloads are validated with zod —
 * a 200 with an unexpected shape is treated as an error.
 */

const productsResponseSchema = createApiResponseSchema(
	createPageResponseSchema(ProductSchema),
);

const categoriesResponseSchema = createApiResponseSchema(
	createPageResponseSchema(CategorySchema),
);

const productDetailResponseSchema = createApiResponseSchema(
	ProductDetailSchema,
);

const CATEGORIES_PAGE_SIZE = 100;

export interface ListProductsParams {
	/** Maps to the API `keyword` param (name-only substring match). */
	keyword?: string;
	/** Maps to the API `category_id` param (descendant-expanded server-side). */
	categoryId?: string;
	/** Inclusive lower bound → API `min_price` (lowest active variant price). */
	minPrice?: number;
	/** Inclusive upper bound → API `max_price` (lowest active variant price). */
	maxPrice?: number;
	/** `ProductSort` enum value (NEWEST | PRICE_ASC | PRICE_DESC). */
	sort: string;
	/**
	 * Forward-compatible per D9: the list endpoint has no `status` filter yet
	 * (defect N1) and ignores this param today; it is sent so it works the
	 * moment the backend honors it. Must be a `ProductStatus` enum value.
	 */
	status: string;
	/** 0-based backend page index. */
	page: number;
	size: number;
}

export async function listProducts(
	params: ListProductsParams,
): Promise<ProductPage> {
	const search = new URLSearchParams();

	if (params.keyword) {
		search.set("keyword", params.keyword);
	}

	if (params.categoryId) {
		search.set("category_id", params.categoryId);
	}

	if (params.minPrice != null) {
		search.set("min_price", String(params.minPrice));
	}

	if (params.maxPrice != null) {
		search.set("max_price", String(params.maxPrice));
	}

	search.set("status", params.status);
	search.set("sort", params.sort);
	search.set("page", String(params.page));
	search.set("size", String(params.size));

	const payload = await apiFetch<unknown>(`products?${search.toString()}`);
	const parsed = productsResponseSchema.safeParse(payload);

	if (!parsed.success) {
		throw new ApiError(
			"The product list response did not match the expected contract.",
			500,
			payload,
		);
	}

	return parsed.data.data;
}

/** Paging options for the aggregate's `reviews` field (backend defect N8). */
export interface ProductDetailParams {
	/** 0-based review page index; applies to reviews only. */
	reviewPage?: number;
	/**
	 * Review page size. The backend defaults to 20 and caps the value at
	 * 100 — values above the cap are clamped server-side, not rejected.
	 */
	reviewSize?: number;
}

/**
 * Fetches the product-detail aggregate — the detail page's single data
 * source (decision D16): product, product attributes, all variants (with
 * their attributes and media) and the first page of reviews in one call.
 *
 * A 404 reaches the caller as `ApiError` with `status === 404` (unknown or
 * non-ACTIVE slug), which the route turns into `notFound()`.
 */
export async function getProductDetailBySlug(
	slug: string,
	params: ProductDetailParams = {},
): Promise<ProductDetail> {
	const search = new URLSearchParams();

	if (params.reviewPage != null) {
		search.set("page", String(params.reviewPage));
	}

	if (params.reviewSize != null) {
		search.set("size", String(params.reviewSize));
	}

	const query = search.toString();
	// `encodeURIComponent` keeps a malformed segment from altering the path.
	const path = `products/${encodeURIComponent(slug)}${
		query ? `?${query}` : ""
	}`;

	const payload = await apiFetch<unknown>(path);
	const parsed = productDetailResponseSchema.safeParse(payload);

	if (!parsed.success) {
		throw new ApiError(
			"The product detail response did not match the expected contract.",
			500,
			payload,
		);
	}

	return parsed.data.data;
}

/** Fetches a single category page (backend caps `size` at 100). */
async function fetchCategoryPage(page: number): Promise<CategoryPage> {
	const payload = await apiFetch<unknown>(
		`categories?page=${page}&size=${CATEGORIES_PAGE_SIZE}`,
	);
	const parsed = categoriesResponseSchema.safeParse(payload);

	if (!parsed.success) {
		throw new ApiError(
			"The category list response did not match the expected contract.",
			500,
			payload,
		);
	}

	return parsed.data.data;
}

/**
 * Fetches every category page and returns the flattened list.
 *
 * Page 0 and page 1 are requested speculatively in parallel: the backend
 * caps `size` at 100 and the current catalog (115 categories) always needs
 * 2 pages, so the sequential gap (~1.1 s per page against this backend)
 * is the listing's biggest avoidable wait after the products query itself.
 * A wasted second call (when a future catalog fits on one page) costs no
 * extra wall time — only a duplicate cheap query.
 */
export async function getCategories(): Promise<Category[]> {
	const [first, second] = await Promise.all([
		fetchCategoryPage(0),
		fetchCategoryPage(1),
	]);

	if (first.totalPages <= 1) {
		return first.content;
	}

	const remaining = await Promise.all(
		Array.from({ length: Math.max(first.totalPages - 2, 0) }, (_, index) =>
			fetchCategoryPage(index + 2),
		),
	);

	return [
		...first.content,
		...second.content,
		...remaining.flatMap((pageData) => pageData.content),
	];
}
