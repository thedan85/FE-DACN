import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import {
	createApiResponseSchema,
	createPageResponseSchema,
	nullDataResponseSchema,
} from "@/lib/api/schema";

import { getAuthHeaders } from "@/features/auth/session";
import { MediaSchema, UploadResultSchema } from "../../schema/catalog.schema";
import type { Media, PageData, UploadResult } from "../../types";
import { validateMediaUrl } from "../model/media";

/**
 * Admin media upload API, mirrored from `UploadController` / `UploadService`
 * (verified live 2026-11-03: a 1×1 PNG uploads and becomes the product's
 * thumbnail; a text file is rejected with `unsupported image type`).
 *
 * Two shapes only, because the backend has two:
 *
 * - a product **thumbnail** (`POST /uploads/products/{id}/thumbnail`) — the one
 *   image a product shows in listings, replaced by uploading again;
 * - a **variant image** (`POST /uploads/variants/{id}`).
 *
 * There is no product-gallery upload: `POST /media` accepts an already-hosted
 * `url` and nothing uploads gallery bytes for a product, so a multi-image
 * gallery, drag-to-reorder and a "make this one the cover" control have no
 * endpoint behind them.
 *
 * The backend validates content type, file extension, a matching magic-byte
 * signature and a 10 MB ceiling, and rejects with a 400 whose message the UI
 * should show verbatim.
 */

const uploadResultResponseSchema = createApiResponseSchema(UploadResultSchema);

/**
 * Posts the file as multipart under the field name the controller expects,
 * `file`. `apiFetch` deliberately omits `Content-Type` for `FormData` so the
 * browser sets the multipart boundary, and this attaches the auth headers.
 */
async function uploadImage(
	path: string,
	file: File,
): Promise<UploadResult> {
	const body = new FormData();
	body.append("file", file);

	const payload = await apiFetch<unknown>(path, {
		method: "POST",
		headers: getAuthHeaders(),
		body,
	});

	return parseOrThrow(
		uploadResultResponseSchema,
		payload,
		"The upload response",
	).data;
}

/**
 * Exactly one of `productId` / `variantId`. `never` on the unused key is
 * what makes both-or-neither a compile-time error at the call site.
 */
export type MediaOwner =
	| { productId: string; variantId?: never }
	| { variantId: string; productId?: never };

const mediaPageResponseSchema = createApiResponseSchema(
	createPageResponseSchema(MediaSchema),
);

const mediaResponseSchema = createApiResponseSchema(MediaSchema);

/**
 * Lists the media rows for one page.
 *
 * `owner` picks the endpoint, never a query parameter: the product route
 * falls back to variant-owned rows when the product has no direct media, so
 * rows come back labelled with their true owner (`variantId` set), and the
 * variant route is exact. Omitting `owner` reads the global list. Page is
 * zero-based; size is clamped to 100 (the backend's `size` ceiling).
 */
export async function listAdminMedia(
	params: { page: number; size: number; owner?: MediaOwner },
	signal?: AbortSignal,
): Promise<PageData<Media>> {
	const page = Math.max(0, Math.trunc(params.page));
	const size = Math.min(Math.max(1, Math.trunc(params.size)), 100);
	const query = `page=${page}&size=${size}`;

	let path: string;

	if (params.owner?.productId) {
		path = `products/${encodeURIComponent(params.owner.productId)}/media?${query}`;
	} else if (params.owner?.variantId) {
		path = `variants/${encodeURIComponent(params.owner.variantId)}/media?${query}`;
	} else {
		path = `media?${query}`;
	}

	const payload = await apiFetch<unknown>(path, {
		headers: getAuthHeaders(),
		signal,
	});

	return parseOrThrow(
		mediaPageResponseSchema,
		payload,
		"The media list response",
	).data;
}

/** Reads one media row by id. */
export async function getAdminMedia(id: string): Promise<Media> {
	const payload = await apiFetch<unknown>(
		`media/${encodeURIComponent(id)}`,
		{ headers: getAuthHeaders() },
	);

	return parseOrThrow(
		mediaResponseSchema,
		payload,
		"The media response",
	).data;
}

/**
 * Creates a media row for exactly one owner. The UI's URL rules are enforced
 * here so a bad URL never reaches the wire — the backend would accept it.
 */
export async function createAdminMedia(
	input: { url: string } & MediaOwner,
): Promise<Media> {
	const problem = validateMediaUrl(input.url);

	if (problem !== null) {
		throw new Error(problem);
	}

	const url = input.url.trim();
	const body =
		input.variantId !== undefined
			? { url, variantId: input.variantId }
			: { url, productId: input.productId };

	const payload = await apiFetch<unknown>("media", {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(body),
	});

	return parseOrThrow(
		mediaResponseSchema,
		payload,
		"The created media response",
	).data;
}

/** Replaces only the media row's URL. */
export async function patchAdminMedia(
	id: string,
	input: { url: string },
): Promise<Media> {
	const payload = await apiFetch<unknown>(
		`media/${encodeURIComponent(id)}`,
		{
			method: "PATCH",
			headers: getAuthHeaders(),
			body: JSON.stringify({ url: input.url }),
		},
	);

	return parseOrThrow(
		mediaResponseSchema,
		payload,
		"The updated media response",
	).data;
}

/**
 * Soft-deletes a media row: it disappears from lists and renders, while the
 * backend keeps the row. The response carries `data: null`.
 */
export async function deleteAdminMedia(id: string): Promise<void> {
	const payload = await apiFetch<unknown>(
		`media/${encodeURIComponent(id)}`,
		{
			method: "DELETE",
			headers: getAuthHeaders(),
		},
	);

	parseOrThrow(
		nullDataResponseSchema,
		payload,
		"The delete-media response",
	);
}

/**
 * Uploads (or replaces) a product's thumbnail. The backend attaches the new
 * media to the product inside the same request, so the returned `mediaId` is
 * already the product's thumbnail — no follow-up write is needed.
 */
export async function uploadProductThumbnail(
	productId: string,
	file: File,
): Promise<UploadResult> {
	return uploadImage(
		`uploads/products/${encodeURIComponent(productId)}/thumbnail`,
		file,
	);
}

/** Uploads an image scoped to one variant; returns the created media. */
export async function uploadVariantImage(
	variantId: string,
	file: File,
): Promise<UploadResult> {
	return uploadImage(
		`uploads/variants/${encodeURIComponent(variantId)}`,
		file,
	);
}
