import type { z } from "zod";

import type {
	CategorySchema,
	MediaSchema,
	ProductAttributeValueSchema,
	ProductDetailSchema,
	ReviewSchema,
	VariantAttributeValueSchema,
	VariantDetailSchema,
	ProductSchema,
} from "../schema/catalog.schema";
import type { CartItemSchema } from "../schema/cart.schema";

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
export type CartItem = z.infer<typeof CartItemSchema>;

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
