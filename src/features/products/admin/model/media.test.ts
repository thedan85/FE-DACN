import { expect, it } from "vitest";

import type { Product, UploadResult, VariantDetail } from "../../types";
import {
	ALLOWED_IMAGE_TYPES,
	IMAGE_ACCEPT_ATTRIBUTE,
	MAX_IMAGE_BYTES,
	buildThumbnailRemovalRequest,
	validateImageFile,
	withUploadedThumbnail,
} from "./media";
import { toVariantRows, variantImageFromUpload } from "./variants";

/**
 * The media rules.
 *
 * Two things here are silent if wrong, which is why they are tested rather than
 * eyeballed:
 *
 * - **The client pre-check has to mirror the backend's rules**, or it either
 *   lets a doomed upload through (a wasted round trip and a slow failure) or
 *   rejects a file the server would have accepted.
 * - **Removing a thumbnail requires `PUT`, not `PATCH`.** A `PATCH` with
 *   `thumbnailMediaId: null` keeps the image (verified live), so the removal
 *   request has to be a *replace* carrying the product's other current values.
 */

it("derives the file picker's accept list from the allowed types", () => {
	// Restating the list in the component would let the picker and the validator
	// drift, so a type could be selectable but refused (or vice versa).
	expect(IMAGE_ACCEPT_ATTRIBUTE).toBe(ALLOWED_IMAGE_TYPES.join(","));
	expect(IMAGE_ACCEPT_ATTRIBUTE).toContain("image/webp");
});

const probe: Product = {
	productId: "PRD_211",
	slug: "zz-media-probe",
	name: "ZZ Media Probe",
	description: "A throwaway product.",
	detailDescription: "Detail copy.",
	thumbnail: "https://res.cloudinary.com/ibk3z2nt/image/upload/v1/a.png",
	thumbnailMediaId: "MED_c0094acf",
	status: "DRAFT",
	categoryId: "epiphyte",
	categoryName: "Epiphyte",
	minPrice: 1000,
	maxPrice: 1000,
	stock: 1,
	createdAt: "2026-11-04T08:00:00Z",
	updatedAt: "2026-11-04T08:00:00Z",
};

/** A file with a declared size, without allocating 10 MB in the test process. */
function fileOf(name: string, type: string, size = 1024): File {
	const file = new File([new Uint8Array(0)], name, { type });
	Object.defineProperty(file, "size", { value: size });
	return file;
}

it("accepts the four image types the backend allows", () => {
	// `UploadService.ALLOWED_TYPES`; anything else is a 400 there.
	for (const [name, type] of [
		["a.png", "image/png"],
		["a.jpg", "image/jpeg"],
		["a.jpeg", "image/jpeg"],
		["a.webp", "image/webp"],
		["a.gif", "image/gif"],
	]) {
		expect(validateImageFile(fileOf(name!, type))).toBeNull();
	}
});

it("accepts a file exactly at the 10 MB ceiling", () => {
	// The backend's check is `bytes.length > MAX_SIZE`, so exactly 10 MB passes.
	expect(validateImageFile(fileOf("a.png", "image/png", MAX_IMAGE_BYTES))).toBeNull();
});

it("rejects a file over 10 MB before it is uploaded", () => {
	const error = validateImageFile(fileOf("a.png", "image/png", MAX_IMAGE_BYTES + 1));

	expect(error).not.toBeNull();
	expect(error).toMatch(/10 MB/i);
});

it("rejects a non-image type, naming what was chosen", () => {
	// The backend's own words for this are `unsupported image type: text/plain`;
	// the client says the same thing sooner so the user is not left waiting on
	// a request that cannot succeed.
	const error = validateImageFile(fileOf("notes.txt", "text/plain"));

	expect(error).not.toBeNull();
	expect(error).toMatch(/text\/plain/);
});

it("rejects an allowed type under a disallowed extension", () => {
	// The backend checks the extension *separately* from the content type and
	// the magic bytes, so a PNG named `.bmp` is still refused. Mirroring only
	// the type would let this one through to a 400.
	const error = validateImageFile(fileOf("photo.bmp", "image/png"));

	expect(error).not.toBeNull();
});

it("removes a thumbnail with PUT, never PATCH", () => {
	// The builder cannot choose a method — there is only one correct one, and the
	// call site is `putProduct`. What it must guarantee is the null, because a
	// PATCH carrying it would be a silent no-op: verified live, the image survived
	// a PATCH and only disappeared on the PUT.
	const body = buildThumbnailRemovalRequest(probe);

	expect(body.thumbnailMediaId).toBeNull();
});

it("carries the product's other values, because PUT replaces", () => {
	// A PUT that omitted these would be a replace with nothing in it; the body
	// has to describe the product as it should stay, minus the image.
	const body = buildThumbnailRemovalRequest(probe);

	expect(body).toMatchObject({
		name: "ZZ Media Probe",
		description: "A throwaway product.",
		detailDescription: "Detail copy.",
		categoryId: "epiphyte",
		slug: "zz-media-probe",
		status: "DRAFT",
	});
});

it("keeps a product's missing category null rather than sending a blank", () => {
	// `categoryId: ""` would be a malformed id; a detached product must send null
	// so the replace does not try to attach one.
	const uncategorised: Product = { ...probe, categoryId: null, categoryName: null };

	expect(buildThumbnailRemovalRequest(uncategorised).categoryId).toBeNull();
});

it("records the uploaded thumbnail without refetching the product", () => {
	// The upload response already names the media it created, so the card can show
	// the new cover immediately; a refetch would only re-derive what we just read.
	const uploaded: UploadResult = {
		url: "https://res.cloudinary.com/ibk3z2nt/image/upload/v2/b.png",
		folder: "home/211",
		productId: "PRD_211",
		variantId: null,
		mediaId: "MED_8a5905fa",
	};

	const next = withUploadedThumbnail(probe, uploaded);

	expect(next.thumbnail).toBe(uploaded.url);
	expect(next.thumbnailMediaId).toBe("MED_8a5905fa");
	// Everything else is untouched — the upload changed exactly one thing.
	expect(next.name).toBe(probe.name);
	expect(next.categoryId).toBe(probe.categoryId);
});

/**
 * Variant images.
 *
 * The detail aggregate embeds `media[]` per variant, but `VariantRow` only needs
 * the two fields the table renders — so the row projects them rather than
 * carrying a DTO whose timestamps nothing reads.
 */
const variantWithImage: VariantDetail = {
	variantId: "VAR_1",
	sku: "MEDIA-PROBE-1",
	price: 1000,
	stock: 1,
	stockRevision: 0,
	attributes: [],
	media: [
		{
			mediaId: "MED_9429ab7a",
			url: "https://res.cloudinary.com/ibk3z2nt/image/upload/v3/c.png",
			productId: null,
			variantId: "VAR_1",
			deleted: false,
			createdAt: "2026-11-04T08:00:00Z",
			updatedAt: "2026-11-04T08:00:00Z",
		},
	],
};

it("projects a variant's existing images onto its row", () => {
	const row = toVariantRows([variantWithImage])[0]!;

	expect(row.images).toEqual([
		{
			mediaId: "MED_9429ab7a",
			url: "https://res.cloudinary.com/ibk3z2nt/image/upload/v3/c.png",
		},
	]);
});

it("starts a variant with no images when it has none", () => {
	expect(toVariantRows([{ ...variantWithImage, media: [] }])[0]!.images).toEqual([]);
});

it("adds a freshly uploaded image to its row", () => {
	const row = toVariantRows([{ ...variantWithImage, media: [] }])[0]!;
	const uploaded: UploadResult = {
		url: "https://res.cloudinary.com/ibk3z2nt/image/upload/v4/d.png",
		folder: "home/211",
		productId: "PRD_211",
		variantId: "VAR_1",
		mediaId: "MED_new",
	};

	// Appending the new image is the caller's job; this only builds the image, so
	// a concurrent price edit in the same row cannot be reverted by an upload.
	const image = variantImageFromUpload(uploaded);

	expect(image).toEqual({
		mediaId: "MED_new",
		url: "https://res.cloudinary.com/ibk3z2nt/image/upload/v4/d.png",
	});
	expect([...row.images, image]).toEqual([image]);
	// An image upload does not touch the row's own fields or picks.
	expect(row.sku).toBe("MEDIA-PROBE-1");
	expect(row.attributes).toEqual([]);
});
