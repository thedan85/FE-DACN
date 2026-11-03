import { afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import {
	createProduct,
	deleteProduct,
	listAdminProducts,
	patchProduct,
	putProduct,
} from "./products.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

/** A `ProductResponse` shaped exactly like the live backend's. */
const productFixture = {
	productId: "PRD_198",
	slug: "zz-probe",
	name: "ZZ Probe",
	description: "probe",
	detailDescription: "probe",
	thumbnail: null,
	thumbnailMediaId: null,
	status: "DRAFT",
	categoryId: "epiphyte",
	categoryName: "Epiphyte",
	minPrice: null,
	maxPrice: null,
	stock: 0,
	createdAt: "2026-11-03T15:23:59.478285Z",
	updatedAt: "2026-11-03T15:23:59.478285Z",
};

function stubFetch(...responses: unknown[]) {
	const fetch = vi.fn();
	for (const response of responses) {
		fetch.mockResolvedValueOnce(
			new Response(JSON.stringify(response), {
				headers: { "Content-Type": "application/json" },
			}),
		);
	}
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

function ok(data: unknown) {
	return { code: 200, message: "OK", data };
}

it("always sends a status and the backend's exact query names", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const page = {
		content: [],
		page: 0,
		size: 20,
		totalElements: 109,
		totalPages: 6,
	};
	const fetch = stubFetch(ok(page));

	const result = await listAdminProducts({
		status: "ACTIVE",
		keyword: "anubias nana",
		categoryId: "epiphyte",
		sort: "PRICE_ASC",
		page: 0,
		size: 20,
	});

	expect(result).toEqual(page);
	const [url, init] = fetch.mock.calls[0];
	const parsed = new URL(String(url));
	expect(parsed.pathname).toBe("/api/v1/products");
	// `status` is not optional on the wire: omitting it means ACTIVE server-side
	// and the API has no "all statuses" query.
	expect(parsed.searchParams.get("status")).toBe("ACTIVE");
	expect(parsed.searchParams.get("keyword")).toBe("anubias nana");
	expect(parsed.searchParams.get("category_id")).toBe("epiphyte");
	expect(parsed.searchParams.get("sort")).toBe("PRICE_ASC");
	expect(init.headers.get("Authorization")).toBe("Bearer test-token");
});

it("passes a non-default status through instead of defaulting to Active", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(
		ok({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
	);

	await listAdminProducts({ status: "DELETED", page: 0, size: 20 });

	const url = new URL(String(fetch.mock.calls[0][0]));
	expect(url.searchParams.get("status")).toBe("DELETED");
	expect(url.searchParams.get("sort")).toBe("NEWEST");
});

it("creates with the requested status in a single POST", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok(productFixture));

	const created = await createProduct({
		name: "ZZ Probe",
		description: "probe",
		status: "DRAFT",
	});

	expect(created.status).toBe("DRAFT");
	expect(fetch).toHaveBeenCalledTimes(1);

	const [url, init] = fetch.mock.calls[0];
	expect(init.method).toBe("POST");
	expect(new URL(String(url)).pathname).toBe("/api/v1/products");
	expect(JSON.parse(String(init.body)).status).toBe("DRAFT");
});

it("rejects a create response that does not match the contract", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	stubFetch(ok({ productId: "PRD_1" }));

	await expect(
		createProduct({ name: "x", description: "y", status: "DRAFT" }),
	).rejects.toBeInstanceOf(ApiError);
});

it("encodes the product id and accepts the null a delete returns", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok(null));

	await expect(deleteProduct("PRD/1")).resolves.toBeUndefined();

	const [url, init] = fetch.mock.calls[0];
	expect(init.method).toBe("DELETE");
	expect(new URL(String(url)).pathname).toBe("/api/v1/products/PRD%2F1");
});

it("patches only the fields it is given", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok({ ...productFixture, status: "INACTIVE" }));

	await patchProduct("PRD_198", { status: "INACTIVE" });

	const [, init] = fetch.mock.calls[0];
	expect(init.method).toBe("PATCH");
	expect(JSON.parse(String(init.body))).toEqual({ status: "INACTIVE" });
});

it("uses PUT where only PUT clears a thumbnail", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok({ ...productFixture, thumbnail: null }));

	await putProduct("PRD_198", { thumbnailMediaId: null });

	const [, init] = fetch.mock.calls[0];
	expect(init.method).toBe("PUT");
	expect(JSON.parse(String(init.body))).toEqual({ thumbnailMediaId: null });
});
