import type { z } from "zod";

import type {
	AttributeSchema,
	AttributeValueSchema,
	CategorySchema,
	MediaSchema,
	ProductAttributeValueCreateRequestSchema,
	ProductAttributeValueSchema,
	ProductCreateRequestSchema,
	ProductDetailSchema,
	ProductUpdateRequestSchema,
	ReviewSchema,
	UploadResultSchema,
	VariantAttributeValueCreateRequestSchema,
	VariantAttributeValueSchema,
	VariantCreateRequestSchema,
	VariantDetailSchema,
	VariantSchema,
	VariantUpdateRequestSchema,
	ProductSchema,
} from "../schema/catalog.schema";

/** Catalog DTO types (single source: `../schema/catalog.schema.ts`). */

export type Product = z.infer<typeof ProductSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Media = z.infer<typeof MediaSchema>;
export type ProductAttributeValue = z.infer<
	typeof ProductAttributeValueSchema
>;
export type VariantAttributeValue = z.infer<
	typeof VariantAttributeValueSchema
>;
export type VariantDetail = z.infer<typeof VariantDetailSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type ProductDetail = z.infer<typeof ProductDetailSchema>;

/** Admin catalog DTOs. */
export type Attribute = z.infer<typeof AttributeSchema>;
export type AttributeValue = z.infer<typeof AttributeValueSchema>;
/** Admin variant row — the `VariantResponse` DTO, not the detail embed. */
export type VariantRecord = z.infer<typeof VariantSchema>;
export type UploadResult = z.infer<typeof UploadResultSchema>;

/** Outgoing admin catalog payloads. */
export type ProductCreateInput = z.infer<typeof ProductCreateRequestSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateRequestSchema>;
export type VariantCreateInput = z.infer<typeof VariantCreateRequestSchema>;
export type VariantUpdateInput = z.infer<typeof VariantUpdateRequestSchema>;
export type ProductAttributeLinkInput = z.infer<
	typeof ProductAttributeValueCreateRequestSchema
>;
export type VariantAttributeLinkInput = z.infer<
	typeof VariantAttributeValueCreateRequestSchema
>;

/** Page envelope returned by the backend for list endpoints. */
export interface PageData<T> {
	content: T[];
	page: number;
	size: number;
	totalElements: number;
	totalPages: number;
}

export type ProductPage = PageData<Product>;
export type CategoryPage = PageData<Category>;
/** The aggregate's `reviews` field (backend defect N8, fixed in `f758bae`). */
export type ReviewPage = PageData<Review>;
