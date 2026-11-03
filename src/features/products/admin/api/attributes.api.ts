import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import {
	createApiResponseSchema,
	createPageResponseSchema,
	nullDataResponseSchema,
} from "@/lib/api/schema";

import { getAuthHeaders } from "@/features/auth/session";
import {
	AttributeSchema,
	AttributeValueSchema,
	ProductAttributeValueSchema,
	VariantAttributeValueSchema,
} from "../../schema/catalog.schema";
import type {
	Attribute,
	AttributeValue,
	PageData,
	ProductAttributeLinkInput,
	ProductAttributeValue,
	VariantAttributeLinkInput,
	VariantAttributeValue,
} from "../../types";

/**
 * Admin attribute API, mirrored from `AttributeController`,
 * `AttributeValueController`, `ProductAttributeController` and
 * `VariantAttributeController` (verified live 2026-11-03).
 *
 * Attributes are the catalog's only structured description: twelve named
 * properties (Temperature, Care level, Color, …) with a fixed list of values
 * each. Products and variants are described by **linking** to a value — there
 * is no free-text spec field, and the storefront's care guide is simply a
 * rendering of the product's links.
 */

/** The backend caps `size` at 100, so this is the widest legal page. */
const PAGE_SIZE = 100;

const attributePageResponseSchema = createApiResponseSchema(
	createPageResponseSchema(AttributeSchema),
);

const attributeValuePageResponseSchema = createApiResponseSchema(
	createPageResponseSchema(AttributeValueSchema),
);

const productAttributeValueResponseSchema = createApiResponseSchema(
	ProductAttributeValueSchema,
);

const variantAttributeValueResponseSchema = createApiResponseSchema(
	VariantAttributeValueSchema,
);

/**
 * Reads every page of a paged endpoint.
 *
 * The catalog fits one page today (12 attributes, 68 values in total, and the
 * backend caps `size` at 100), so this normally costs a single request. It
 * still walks the pages because a silently truncated attribute list would be
 * indistinguishable from a complete one — the editor would simply never offer
 * the missing values, and nothing would report an error.
 */
async function collectPages<T>(
	fetchPage: (page: number) => Promise<PageData<T>>,
): Promise<T[]> {
	const first = await fetchPage(0);

	if (first.totalPages <= 1) {
		return first.content;
	}

	const rest = await Promise.all(
		Array.from({ length: first.totalPages - 1 }, (_, index) =>
			fetchPage(index + 1),
		),
	);

	return [...first.content, ...rest.flatMap((page) => page.content)];
}

async function fetchAttributePage(page: number): Promise<PageData<Attribute>> {
	const payload = await apiFetch<unknown>(
		`attributes?page=${page}&size=${PAGE_SIZE}`,
		{ headers: getAuthHeaders() },
	);

	return parseOrThrow(
		attributePageResponseSchema,
		payload,
		"The attribute list response",
	).data;
}

/** Every attribute, flattened across pages. */
export async function listAttributes(): Promise<Attribute[]> {
	return collectPages(fetchAttributePage);
}

async function fetchAttributeValuePage(
	attributeId: string,
	page: number,
): Promise<PageData<AttributeValue>> {
	const payload = await apiFetch<unknown>(
		`attributes/${encodeURIComponent(attributeId)}/values?page=${page}&size=${PAGE_SIZE}`,
		{ headers: getAuthHeaders() },
	);

	return parseOrThrow(
		attributeValuePageResponseSchema,
		payload,
		"The attribute value list response",
	).data;
}

/**
 * Every allowed value of one attribute — the second level of the editor's
 * two-step picker, so the UI never has to list all 68 values at once.
 */
export async function listAttributeValues(
	attributeId: string,
): Promise<AttributeValue[]> {
	return collectPages((page) => fetchAttributeValuePage(attributeId, page));
}

/** Links an attribute value to a product. */
export async function addProductAttribute(
	input: ProductAttributeLinkInput,
): Promise<ProductAttributeValue> {
	const payload = await apiFetch<unknown>("product-attributes", {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(input),
	});

	return parseOrThrow(
		productAttributeValueResponseSchema,
		payload,
		"The created product attribute response",
	).data;
}

/** Removes one product attribute link by its `productValueId`. */
export async function removeProductAttribute(
	productValueId: string,
): Promise<void> {
	await deleteLink(
		`product-attributes/${encodeURIComponent(productValueId)}`,
		"The product attribute deletion response",
	);
}

/** Links an attribute value to a variant. */
export async function addVariantAttribute(
	input: VariantAttributeLinkInput,
): Promise<VariantAttributeValue> {
	const payload = await apiFetch<unknown>("variant-attributes", {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(input),
	});

	return parseOrThrow(
		variantAttributeValueResponseSchema,
		payload,
		"The created variant attribute response",
	).data;
}

/** Removes one variant attribute link by its `variantValueId`. */
export async function removeVariantAttribute(
	variantValueId: string,
): Promise<void> {
	await deleteLink(
		`variant-attributes/${encodeURIComponent(variantValueId)}`,
		"The variant attribute deletion response",
	);
}

async function deleteLink(path: string, description: string): Promise<void> {
	const payload = await apiFetch<unknown>(path, {
		method: "DELETE",
		headers: getAuthHeaders(),
	});

	parseOrThrow(nullDataResponseSchema, payload, description);
}
