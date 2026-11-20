import { afterEach, expect, it, vi } from "vitest";

import {
	createAdminMedia,
	deleteAdminMedia,
	getAdminMedia,
	listAdminMedia,
	patchAdminMedia,
	uploadProductThumbnail,
	uploadVariantImage,
} from "./media.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

const uploadFixture = {
	url: "https://res.cloudinary.com/x/y.png",
	folder: "home/aquatic-plants/epiphyte/198",
	productId: "PRD_198",
	variantId: null,
	mediaId: "MED_abc",
};

const mediaFixture = {
	mediaId: "MED_1",
	url: "https://res.cloudinary.com/ibk3z2nt/image/upload/v1/sample.png",
	productId: "PRD_1",
	variantId: null,
	deleted: false,
	createdAt: "2026-11-01T00:00:00Z",
	updatedAt: "2026-11-01T00:00:00Z",
};

function callArgs(fetch: ReturnType<typeof vi.fn>, index = 0) {
	const [url, init] = fetch.mock.calls[index] as unknown as [
		string | URL,
		RequestInit,
	];

	return { url: String(url), init, headers: new Headers(init.headers) };
}

function mediaPage(
	content: unknown[],
	pageNumber = 0,
	totalPages = 1,
	totalElements = content.length,
) {
	return {
		content,
		page: pageNumber,
		size: 20,
		totalElements,
		totalPages,
	};
}

function stubFetch(response: unknown) {
	const fetch = vi.fn().mockResolvedValueOnce(
		new Response(JSON.stringify({ code: 200, message: "OK", data: response }), {
			headers: { "Content-Type": "application/json" },
		}),
	);
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

it("posts the thumbnail as multipart under the field the controller expects", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(uploadFixture);

	const file = new File([new Uint8Array([1, 2, 3])], "cover.png", {
		type: "image/png",
	});
	const result = await uploadProductThumbnail("PRD_198", file);

	expect(result.mediaId).toBe("MED_abc");
	const [url, init] = fetch.mock.calls[0];
	expect(new URL(String(url)).pathname).toBe(
		"/api/v1/uploads/products/PRD_198/thumbnail",
	);
	expect(init.body).toBeInstanceOf(FormData);
	const body = init.body;
	if (!(body instanceof FormData)) {
		throw new Error("expected a FormData body");
	}
	expect(body.get("file")).toBe(file);
	// A multipart boundary must be browser-generated; a JSON content type would
	// make the backend reject the request before it ever reads the file.
	expect(init.headers.get("Content-Type")).not.toBe("application/json");
	expect(init.headers.get("Authorization")).toBe("Bearer test-token");
});

it("uploads a variant image to the variant endpoint", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch({ ...uploadFixture, variantId: "VAR_1" });

	await uploadVariantImage(
		"VAR_1",
		new File([new Uint8Array([1])], "v.png", { type: "image/png" }),
	);

	expect(new URL(String(fetch.mock.calls[0][0])).pathname).toBe(
		"/api/v1/uploads/variants/VAR_1",
	);
});

it("mediaCreate_usesExactlyOneOwner", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch({ ...mediaFixture, productId: null, variantId: "VAR_1" });

	const created = await createAdminMedia({
		url: "https://example.com/image.png",
		variantId: "VAR_1",
	});

	expect(created.variantId).toBe("VAR_1");
	const { url, init, headers } = callArgs(fetch);
	expect(init.method).toBe("POST");
	expect(new URL(url).pathname).toBe("/api/v1/media");
	const body = JSON.parse(String(init.body));
	expect(body).toEqual({ url: "https://example.com/image.png", variantId: "VAR_1" });
	expect(body).not.toHaveProperty("productId");
	expect(headers.get("Authorization")).toBe("Bearer test-token");
});

it("listAdminMedia selects the endpoint from the owner and sends auth headers", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");

	const globalFetch = vi
		.fn()
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ code: 200, message: "OK", data: mediaPage([]) }),
				{ headers: { "Content-Type": "application/json" } },
			),
		);
	vi.stubGlobal("fetch", globalFetch);
	await listAdminMedia({ page: 2, size: 20 });
	const globalCall = callArgs(globalFetch);
	expect(new URL(globalCall.url).pathname).toBe("/api/v1/media");
	expect(new URL(globalCall.url).searchParams.get("page")).toBe("2");
	expect(new URL(globalCall.url).searchParams.get("owner")).toBeNull();
	expect(globalCall.headers.get("Authorization")).toBe("Bearer test-token");

	const productFetch = vi
		.fn()
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ code: 200, message: "OK", data: mediaPage([]) }),
				{ headers: { "Content-Type": "application/json" } },
			),
		);
	vi.stubGlobal("fetch", productFetch);
	await listAdminMedia({ page: 0, size: 20, owner: { productId: "PRD_1" } });
	const productCall = callArgs(productFetch);
	expect(new URL(productCall.url).pathname).toBe("/api/v1/products/PRD_1/media");
	expect(new URL(productCall.url).searchParams.get("owner")).toBeNull();
	expect(productCall.headers.get("Authorization")).toBe("Bearer test-token");

	const variantFetch = vi
		.fn()
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ code: 200, message: "OK", data: mediaPage([]) }),
				{ headers: { "Content-Type": "application/json" } },
			),
		);
	vi.stubGlobal("fetch", variantFetch);
	await listAdminMedia({ page: 0, size: 20, owner: { variantId: "VAR_1" } });
	const variantCall = callArgs(variantFetch);
	expect(new URL(variantCall.url).pathname).toBe(
		"/api/v1/variants/VAR_1/media",
	);
	expect(new URL(variantCall.url).searchParams.get("owner")).toBeNull();
	expect(variantCall.headers.get("Authorization")).toBe("Bearer test-token");
});

it("getAdminMedia reads the media row", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(mediaFixture);

	const media = await getAdminMedia("MED_1");

	expect(media.mediaId).toBe("MED_1");
	expect(new URL(callArgs(fetch).url).pathname).toBe("/api/v1/media/MED_1");
});

it("patchAdminMedia sends the url and nothing else", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch({
		...mediaFixture,
		url: "https://example.com/new.png",
	});

	await patchAdminMedia("MED_1", { url: "https://example.com/new.png" });

	const { url, init } = callArgs(fetch);
	expect(init.method).toBe("PATCH");
	expect(new URL(url).pathname).toBe("/api/v1/media/MED_1");
	expect(JSON.parse(String(init.body))).toEqual({
		url: "https://example.com/new.png",
	});
});

it("deleteAdminMedia issues a DELETE and accepts the null body", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(null);

	await expect(deleteAdminMedia("MED_1")).resolves.toBeUndefined();
	const { url, init } = callArgs(fetch);
	expect(init.method).toBe("DELETE");
	expect(new URL(url).pathname).toBe("/api/v1/media/MED_1");
});

it("mediaClientRejectsNonHttpsOrCredentialedUrl", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn();
	vi.stubGlobal("fetch", fetch);

	await expect(
		createAdminMedia({
			url: "http://example.com/image.png",
			productId: "PRD_1",
		}),
	).rejects.toThrow();
	await expect(
		createAdminMedia({
			url: "https://user:pass@example.com/image.png",
			productId: "PRD_1",
		}),
	).rejects.toThrow();

	expect(fetch).not.toHaveBeenCalled();
});
