import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import { createApiResponseSchema } from "@/lib/api/schema";

import { getAuthHeaders } from "@/features/auth/session";
import { UploadResultSchema } from "../../schema/catalog.schema";
import type { UploadResult } from "../../types";

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
