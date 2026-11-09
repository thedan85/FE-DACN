import { ApiError, apiFetch } from "@/lib/api/client";
import {
	createApiResponseSchema,
	createPageResponseSchema,
} from "@/lib/api/schema";

import { buildProductListQuery } from "../model/product-list-query";
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
 * contract re-verified against backend `dev` @ `49b698e` on 2026-10-28.
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

/**
 * Storefront data is cached in the Next.js data cache. Stock and prices are
 * part of the payload, so keep the window short; categories barely change.
 */
const PRODUCT_REVALIDATE_SECONDS = 30;
const CATEGORY_REVALIDATE_SECONDS = 300;

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
	const payload = await apiFetch<unknown>(
		`products?${buildProductListQuery(params)}`,
		{ next: { revalidate: PRODUCT_REVALIDATE_SECONDS } },
	);
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
 *
 * `options.headers` exists for staff reads: the backend hides DRAFT/INACTIVE
 * products from anonymous callers, so the admin portal passes auth headers
 * through the same request rather than re-implementing it. It is narrowed to
 * `headers` on purpose — accepting a whole `RequestInit` would let a caller
 * change the method or body of a function whose name promises a GET.
 */
export async function getProductDetailBySlug(
	slug: string,
	params: ProductDetailParams = {},
	options: { headers?: HeadersInit } = {},
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

	const payload = await apiFetch<unknown>(path, {
		headers: options.headers,
		// Staff reads must stay live; anonymous storefront reads are cacheable.
		...(options.headers ? {} : { next: { revalidate: PRODUCT_REVALIDATE_SECONDS } }),
	});
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
		{ next: { revalidate: CATEGORY_REVALIDATE_SECONDS } },
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
 * Page 0 is fetched first so a one-page catalog costs a single request; extra
 * pages are fetched in parallel only when the first page says they exist.
 * Combined with the data cache, that keeps the common path at one request.
 */
export async function getCategories(): Promise<Category[]> {
	const first = await fetchCategoryPage(0);

	if (first.totalPages <= 1) {
		return first.content;
	}

	const remaining = await Promise.all(
		Array.from({ length: first.totalPages - 1 }, (_, index) =>
			fetchCategoryPage(index + 1),
		),
	);

	return [
		...first.content,
		...remaining.flatMap((pageData) => pageData.content),
	];
}
