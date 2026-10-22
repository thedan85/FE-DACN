import type { z } from "zod";

import type {
	CategorySchema,
	MediaSchema,
	ProductAttributeValueSchema,
	ProductSchema,
	VariantSchema,
} from "../schema/catalog.schema";

/** Catalog DTO types (single source: `../schema/catalog.schema.ts`). */

export type Product = z.infer<typeof ProductSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type ProductAttributeValue = z.infer<
	typeof ProductAttributeValueSchema
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
