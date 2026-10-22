import { z } from "zod";

import { ProductStatusSchema } from "@/lib/api/schema";

/**
 * Catalog DTO schemas, mirroring the backend response records
 * (`.opencode/refs/backend/dto/response/*` + live `/v3/api-docs`, verified 2026-10-22).
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
