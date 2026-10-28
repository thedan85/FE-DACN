import { z } from "zod";

import { createPageResponseSchema, ProductStatusSchema } from "@/lib/api/schema";

/**
 * Catalog DTO schemas, mirroring the backend response records
 * (`.opencode/refs/backend/dto/response/*` + live `/v3/api-docs`, verified
 * 2026-10-22; the product-detail DTOs re-verified against backend `dev` @
 * `f758bae` on 2026-10-26).
 *
 * Unknown keys are stripped by default, so newly added backend fields
 * (e.g. a future stock signal on ProductResponse) do not break parsing.
 */

export const ProductSchema = z.object({
	productId: z.string(),
	slug: z.string(),
	name: z.string(),
	description: z.string(),
	detailDescription: z.string(),
	thumbnail: z.string().nullable(),
	thumbnailMediaId: z.string().nullable(),
	status: ProductStatusSchema,
	categoryId: z.string().nullable(),
	categoryName: z.string().nullable(),
	minPrice: z.number().nullable(),
	maxPrice: z.number().nullable(),
	/**
	 * Total stock across the product's variants (backend defect N2, fixed
	 * 2026-10-22). The backend always sends an int today (0 when there are no
	 * variants), but it is nullable in the DTO and the field was added after
	 * the listing shipped — `nullish` keeps already-merged consumers parsing
	 * if an older payload ever omits it. Treat `undefined`/`null` as 0.
	 */
	stock: z.number().int().nullish(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const CategorySchema = z.object({
	categoryId: z.string(),
	name: z.string(),
	slug: z.string(),
	parentCategoryId: z.string().nullable(),
	deleted: z.boolean().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const VariantSchema = z.object({
	id: z.number().int(),
	variantId: z.string(),
	sku: z.string(),
	price: z.number(),
	stock: z.number().int(),
	productId: z.string(),
	productName: z.string(),
	deleted: z.boolean().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const MediaSchema = z.object({
	mediaId: z.string(),
	url: z.string(),
	productId: z.string().nullable(),
	variantId: z.string().nullable(),
	deleted: z.boolean().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const ProductAttributeValueSchema = z.object({
	productValueId: z.string(),
	productId: z.string(),
	attributeId: z.string(),
	attributeName: z.string(),
	attributeValueId: z.string(),
	attributeValue: z.string(),
	createdAt: z.string(),
});

/**
 * `GET /api/v1/products/{slug}` → `ProductDetailResponse`
 * (`{ product, attributes[], variants[], reviews }`), backend `dev` @
 * `f758bae`, verified live 2026-10-26. This is the detail page's single data
 * source — no sub-resource endpoints are called (D16).
 */

/** One row of `VariantDetailResponse.attributes[]`. */
export const VariantAttributeValueSchema = z.object({
	variantValueId: z.string(),
	variantId: z.string(),
	attributeId: z.string(),
	attributeName: z.string(),
	attributeValueId: z.string(),
	attributeValue: z.string(),
	createdAt: z.string(),
});

/** `VariantDetailResponse` — note: no numeric `id`; the cart takes the string id. */
export const VariantDetailSchema = z.object({
	variantId: z.string(),
	sku: z.string(),
	price: z.number(),
	stock: z.number().int(),
	attributes: z.array(VariantAttributeValueSchema),
	media: z.array(MediaSchema),
});

/**
 * `ReviewResponse` as shipped to storefront callers: `customerId` is
 * staff-only (`@JsonInclude(NON_NULL)`) and `customerName` is present instead
 * (backend defect N7, fixed in `f758bae`).
 */
export const ReviewSchema = z.object({
	reviewId: z.string(),
	variantId: z.string(),
	customerName: z.string().nullable(),
	/** Null for reviews not tied to an order item → no "Verified purchase" tag. */
	orderItemId: z.number().int().nullable(),
	/** DB CHECK `chk_reviews_rating` constrains this to 1–5. */
	rating: z.number().int().min(1).max(5),
	comment: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const ProductDetailSchema = z.object({
	product: ProductSchema,
	/** Product-level specification rows (unpaginated). */
	attributes: z.array(ProductAttributeValueSchema),
	/** All variants of the product (unpaginated). */
	variants: z.array(VariantDetailSchema),
	/**
	 * Paginated by `?page=`/`?size=` on the detail endpoint (default size 20,
	 * backend caps at 100); those params affect reviews only (N8, fixed in
	 * `f758bae`).
	 */
	reviews: createPageResponseSchema(ReviewSchema),
});
