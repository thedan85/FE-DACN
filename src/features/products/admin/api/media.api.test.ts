import { afterEach, expect, it, vi } from "vitest";

import { uploadProductThumbnail, uploadVariantImage } from "./media.api";

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
