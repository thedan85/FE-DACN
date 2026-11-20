import { isOptimizableImageUrl } from "@/lib/utils/image-src";

import type { Product, ProductUpdateInput, UploadResult } from "../../types";
import { productCurrentValues } from "./product-edit";

/**
 * The two media shapes the API supports, and the rules around them.
 *
 * A product has exactly one **thumbnail**; a variant has any number of
 * **images**. There is no product gallery: `POST /media` accepts an
 * already-hosted URL and nothing uploads gallery bytes for a product, so a
 * multi-image gallery, drag-to-reorder and a "set as cover" control have no
 * endpoint behind them (`media.api.ts` records the same absence).
 *
 * The checks below mirror `UploadService.readAndValidate` (read 2026-11-04) so
 * the common rejection is a local message instead of a round trip — but the
 * backend's 400 stays authoritative and its wording is what the UI shows when
 * the two disagree.
 */

/** `UploadService.MAX_SIZE` — 10 MiB, not 10,000,000. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * The media row's URL rules as the UI enforces them. The backend's
 * `MediaCreateRequest` only checks `@NotBlank`, so these are the UI's
 * responsibility — HTTPS only, bounded length, no embedded credentials
 * (`https://user:pass@host/...` would leak the secret into every rendered
 * image URL).
 */
export const MEDIA_URL_MAX_LENGTH = 500;

/** Why this URL cannot be used for a media row, or `null` when it can. */
export function validateMediaUrl(url: string): string | null {
	const trimmed = url.trim();

	if (!trimmed) {
		return "Enter the image URL.";
	}

	if (trimmed.length > MEDIA_URL_MAX_LENGTH) {
		return `The URL must be ${MEDIA_URL_MAX_LENGTH} characters or fewer.`;
	}

	let parsed: URL;

	try {
		parsed = new URL(trimmed);
	} catch {
		return "That URL is not valid. Check it and try again.";
	}

	if (parsed.protocol !== "https:") {
		return "The URL must start with https://.";
	}

	if (parsed.username || parsed.password) {
		return "The URL must not embed credentials.";
	}

	return null;
}

/** What a media row renders as. */
export type MediaPreview =
	/** The Cloudinary host the Next image config allows — rendered as an image. */
	| { kind: "image" }
	/** Another absolute HTTPS host without credentials renders as an external link. */
	| { kind: "link"; href: string }
	/** Relative, credentialed, non-HTTPS or malformed URLs render neither. */
	| { kind: "none" };

/**
 * What a media row is allowed to render. A row URL is bound by the media
 * contract to an absolute HTTPS URL without credentials: relative paths must
 * not turn into previews just because the shared image gate also accepts local
 * static assets, and a credential must never be copied into a rendered href.
 * Only after parsing does the image branch reuse the same gate as every catalog
 * `<Image>`; a safe external HTTPS host degrades to a link with
 * `rel="noreferrer"`, and an unusable URL renders nothing clickable.
 */
export function mediaPreviewKind(url: string): MediaPreview {
	let parsed: URL;

	try {
		parsed = new URL(url);
	} catch {
		return { kind: "none" };
	}

	if (
		parsed.protocol !== "https:" ||
		parsed.username !== "" ||
		parsed.password !== ""
	) {
		return { kind: "none" };
	}

	if (isOptimizableImageUrl(url)) {
		return { kind: "image" };
	}

	return { kind: "link", href: parsed.toString() };
}

/**
 * The owner label for a media row. Rows are labelled from their returned
 * owner fields, never from the filter that found them: the product media
 * endpoint falls back to variant-owned rows when the product has no direct
 * media. Absent metadata degrades to "—" rather than a guess.
 */
export function ownerLabel(media: {
	productId: string | null;
	variantId: string | null;
}): string {
	const variant = media.variantId?.trim();

	if (variant) {
		return `Variant ${variant}`;
	}

	const product = media.productId?.trim();

	if (product) {
		return `Product ${product}`;
	}

	return "—";
}

/**
 * `UploadService.ALLOWED_TYPES`, in the order the picker lists them.
 *
 * Exported because the file picker's `accept` attribute has to name the same
 * types; restating them there would let the two drift, and a new type would then
 * need editing in two places to be both selectable and accepted.
 */
export const ALLOWED_IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
] as const;

/** The `accept` value for a file input, derived from the list above. */
export const IMAGE_ACCEPT_ATTRIBUTE = ALLOWED_IMAGE_TYPES.join(",");

/** `UploadService.ALLOWED_EXTENSIONS`. */
const ALLOWED_IMAGE_EXTENSIONS = new Set([
	"jpg",
	"jpeg",
	"png",
	"webp",
	"gif",
]);

function extensionOf(filename: string): string {
	const dot = filename.lastIndexOf(".");
	return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

/**
 * Why this file cannot be uploaded, or `null` when it can be.
 *
 * Returning the reason (not a boolean) lets the caller show it and refuse the
 * upload for the same cause, so the two cannot disagree — the same shape as
 * `resolveAddBlock` in the attribute picker.
 *
 * The size comparison is `> MAX`, matching the backend: a file of exactly 10 MB
 * is accepted there and must not be refused here.
 */
export function validateImageFile(file: File): string | null {
	// The magic-byte check stays server-side only: reading the bytes here to
	// compare signatures would duplicate a check the server performs anyway, on
	// data it already has.
	if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
		return `That file is ${file.type || "not an image"}. Choose a JPG, PNG, WebP or GIF.`;
	}

	if (file.size > MAX_IMAGE_BYTES) {
		return "That image is larger than 10 MB. Choose a smaller file.";
	}

	if (!ALLOWED_IMAGE_EXTENSIONS.has(extensionOf(file.name))) {
		return "That file's name is not an image extension. Choose a JPG, PNG, WebP or GIF.";
	}

	return null;
}

/**
 * The body that removes a product's thumbnail.
 *
 * **It must be sent as a `PUT`, not a `PATCH`.** `ProductService.update` assigns
 * a thumbnail only when one is supplied and `replace` assigns the supplied value
 * unconditionally, so `PATCH {thumbnailMediaId: null}` is a silent no-op that
 * leaves the image in place — verified live on 2026-11-04: the PATCH returned
 * 200 and the thumbnail survived, while the PUT cleared it.
 *
 * The method is not returned alongside the body because there is only ever one
 * correct choice; the call site is `putProduct`. Because `PUT` replaces, the body
 * restates the product's current values (`productCurrentValues`), and a product
 * with no category sends `null` rather than `""`, which would be a malformed id.
 */
export function buildThumbnailRemovalRequest(
	product: Product,
): ProductUpdateInput {
	return {
		...productCurrentValues(product),
		thumbnailMediaId: null,
	};
}

/**
 * The product with the thumbnail the upload just created.
 *
 * `POST /uploads/products/{id}/thumbnail` wires the new media as the product's
 * thumbnail inside the same request, so there is nothing to re-read: the
 * response already names the `mediaId` and `url` the aggregate would return.
 */
export function withUploadedThumbnail(
	product: Product,
	upload: UploadResult,
): Product {
	return {
		...product,
		thumbnail: upload.url,
		thumbnailMediaId: upload.mediaId,
	};
}
