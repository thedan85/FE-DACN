import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import {
	createApiResponseSchema,
	createPageResponseSchema,
	nullDataResponseSchema,
} from "@/lib/api/schema";

import { getAuthHeaders } from "@/features/auth/session";
import type { ProductStatus } from "@/types";
import { buildProductListQuery } from "../../model/product-list-query";
import { getProductDetailBySlug } from "../../api/products.api";
import type { ProductDetailParams } from "../../api/products.api";
import { ProductSchema } from "../../schema/catalog.schema";
import type {
	Product,
	ProductCreateInput,
	ProductDetail,
	ProductPage,
	ProductUpdateInput,
} from "../../types";

/**
 * Admin catalog API (`/admin/products`), verified against the live backend on
 * 2026-11-03 and mirrored from `ProductController` / `ProductService` in the
 * backend repo.
 *
 * Two contract facts shape this module:
 *
 * - **`status` is one value, and omitting it means `ACTIVE`.** The controller
 *   pins non-privileged callers to `ACTIVE` and defaults privileged ones to it,
 *   so a listing that wants drafts must ask for them explicitly.
 * - **Reads are by slug, writes by `productId`.** `GET /products/{slug}` is the
 *   only detail route; `PUT`/`PATCH`/`DELETE` take the id. Editing therefore
 *   loads by slug and saves by the id found in the payload.
 */

const productPageResponseSchema = createApiResponseSchema(
	createPageResponseSchema(ProductSchema),
);

const productResponseSchema = createApiResponseSchema(ProductSchema);

/**
 * The backend's `ProductSort` enum as its converter accepts it: it upper-cases
 * and turns `-` into `_`, and the contract spells the values
 * `newest | price_asc | price_desc`. Anything else is a 400, so this is a
 * closed union rather than a free string.
 */
export type AdminProductSort = "NEWEST" | "PRICE_ASC" | "PRICE_DESC";

export interface ListAdminProductsParams {
	/** Case-insensitive substring of the product **name** (not SKU). */
	keyword?: string;
	/** Category id; the backend expands it to the whole descendant subtree. */
	categoryId?: string;
	/** Inclusive lower bound on the lowest active variant price. */
	minPrice?: number;
	/** Inclusive upper bound on the lowest active variant price. */
	maxPrice?: number;
	/** Required: the API has no "all statuses" query. */
	status: ProductStatus;
	sort?: AdminProductSort;
	/** 0-based page index. */
	page: number;
	size: number;
}

/** Lists one page of products for the requested status. */
export async function listAdminProducts(
	params: ListAdminProductsParams,
): Promise<ProductPage> {
	const payload = await apiFetch<unknown>(
		`products?${buildProductListQuery({ ...params, sort: params.sort ?? "NEWEST" })}`,
		{ headers: getAuthHeaders() },
	);

	return parseOrThrow(
		productPageResponseSchema,
		payload,
		"The product list response",
	).data;
}

/**
 * Staff read of the detail aggregate — the same request the storefront makes,
 * with auth headers so DRAFT/INACTIVE products resolve instead of 404ing.
 */
export async function getAdminProductDetailBySlug(
	slug: string,
	params: ProductDetailParams = {},
): Promise<ProductDetail> {
	return getProductDetailBySlug(slug, params, {
		headers: getAuthHeaders(),
	});
}

/**
 * Creates a product with the requested status in a single request.
 *
 * A duplicate slug is a 409 and reaches the caller as `ApiError` carrying the
 * backend's message — surface it on the slug field rather than retrying.
 */
export async function createProduct(
	input: ProductCreateInput,
): Promise<Product> {
	const payload = await apiFetch<unknown>("products", {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(input),
	});

	return parseOrThrow(
		productResponseSchema,
		payload,
		"The created product response",
	).data;
}

/**
 * Patches a product: only the provided fields change, and a `null`
 * `thumbnailMediaId` is ignored — use `putProduct` to clear a thumbnail.
 * A duplicate slug is a 409.
 */
export async function patchProduct(
	productId: string,
	input: ProductUpdateInput,
): Promise<Product> {
	const payload = await apiFetch<unknown>(
		`products/${encodeURIComponent(productId)}`,
		{
			method: "PATCH",
			headers: getAuthHeaders(),
			body: JSON.stringify(input),
		},
	);

	return parseOrThrow(
		productResponseSchema,
		payload,
		"The updated product response",
	).data;
}

/**
 * `PUT` replace semantics. Differs from PATCH in exactly one way that matters
 * here: an omitted `thumbnailMediaId` **clears** the thumbnail, which is the
 * only way the API exposes to remove one (`ProductService.replace` assigns
 * `null`; `update` only assigns a truthy id).
 */
export async function putProduct(
	productId: string,
	input: ProductUpdateInput,
): Promise<Product> {
	const payload = await apiFetch<unknown>(
		`products/${encodeURIComponent(productId)}`,
		{
			method: "PUT",
			headers: getAuthHeaders(),
			body: JSON.stringify(input),
		},
	);

	return parseOrThrow(
		productResponseSchema,
		payload,
		"The replaced product response",
	).data;
}

/**
 * Deletes a product. The backend sets status `DELETED` and keeps the row, so
 * the product stays readable under `status=DELETED` and its slug stays
 * reserved (ADR-0002).
 */
export async function deleteProduct(productId: string): Promise<void> {
	const payload = await apiFetch<unknown>(
		`products/${encodeURIComponent(productId)}`,
		{
			method: "DELETE",
			headers: getAuthHeaders(),
		},
	);

	parseOrThrow(
		nullDataResponseSchema,
		payload,
		"The delete-product response",
	);
}
