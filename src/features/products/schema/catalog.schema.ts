import { z } from "zod";

import { createPageResponseSchema, ProductStatusSchema } from "@/lib/api/schema";

/**
 * Catalog DTO schemas, mirroring the backend response records
 * (`.opencode/refs/backend/dto/response/*` + live `/v3/api-docs`, verified
 * 2026-10-22; the product-detail DTOs re-verified against backend `dev` @
 * `49b698e` on 2026-10-28).
 *
 * Unknown keys are stripped by default, so newly added backend fields
 * (e.g. a future stock signal on ProductResponse) do not break parsing.
 */

export const ProductSchema = z.object({
	productId: z.string(),
	slug: z.string(),
	name: z.string(),
	/**
	 * Both description fields are `nullish` with a `""` fallback: the DTO
	 * records can carry `null` (and older payloads may omit them), but every
	 * consumer treats them as plain strings — `splitParagraphs` splits and
	 * `ProductCareGuide` returns `null` on an empty heading, so normalising
	 * to `""` here keeps downstream types unchanged and rendering safe.
	 */
	description: z
		.string()
		.nullish()
		.transform((value) => value ?? ""),
	detailDescription: z
		.string()
		.nullish()
		.transform((value) => value ?? ""),
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
 * `49b698e`, verified live 2026-10-28. This is the detail page's single data
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
 * staff-only (`@JsonInclude(NON_NULL)`) and `customerName` is present instead.
 * `verifiedPurchase` replaces the old `orderItemId` so database ids are no
 * longer exposed (backend `dev` @ `49b698e`, 2026-10-28).
 */
export const ReviewSchema = z.object({
	reviewId: z.string(),
	variantId: z.string(),
	customerName: z.string().nullable(),
	/** True when the review is tied to a purchased order item. */
	verifiedPurchase: z.boolean(),
	/** DB CHECK `chk_reviews_rating` constrains this to 1-5. */
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
