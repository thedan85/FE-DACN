import { afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import { createVariant, deleteVariant, patchVariant } from "./variants.api";

/**
 * The variant endpoints' wire behaviour.
 *
 * These are the facts a stubbed response can prove and a live probe cannot
 * prove cheaply on every run: the exact paths, the method, and that the 409 a
 * duplicate SKU produces reaches the caller as an `ApiError` carrying the
 * backend's own message. The *shape* the backend actually sends is verified
 * separately against `localhost:8080` (spec.md § Testing Decisions).
 */

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function ok(data: unknown) {
	return { code: 200, message: "OK", data };
}

const created = {
	variantId: "VAR_FISH-NEW",
	sku: "FISH-NEW",
	price: 15000,
	stock: 4,
	productId: "PRD_172",
	productName: "Penguin Tetra",
	deleted: false,
	createdAt: "2026-11-04T08:00:00Z",
	updatedAt: "2026-11-04T08:00:00Z",
};

it("creates a variant under /variants and returns its generated id", async () => {
	// The id is the whole point of creating first: attribute links and later
	// edits are addressed by it, so a row must not be staged locally.
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValueOnce(jsonResponse(ok(created)));
	vi.stubGlobal("fetch", fetch);

	const variant = await createVariant({
		productId: "PRD_172",
		sku: "FISH-NEW",
		price: 15000,
		stock: 4,
	});

	expect(variant.variantId).toBe("VAR_FISH-NEW");
	const [url, init] = fetch.mock.calls[0];
	expect(new URL(String(url)).pathname).toBe("/api/v1/variants");
	expect(init.method).toBe("POST");
	expect(JSON.parse(String(init.body))).toEqual({
		productId: "PRD_172",
		sku: "FISH-NEW",
		price: 15000,
		stock: 4,
	});
});

it("patches an existing variant by its own id", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi
		.fn()
		.mockResolvedValueOnce(jsonResponse(ok({ ...created, stock: 9 })));
	vi.stubGlobal("fetch", fetch);

	const variant = await patchVariant("VAR_FISH-NEW", { stock: 9 });

	expect(variant.stock).toBe(9);
	const [url, init] = fetch.mock.calls[0];
	expect(new URL(String(url)).pathname).toBe("/api/v1/variants/VAR_FISH-NEW");
	// PATCH, not PUT: `VariantService.replace` delegates to `update`, so the two
	// are the same request and there is no method choice to make.
	expect(init.method).toBe("PATCH");
	expect(JSON.parse(String(init.body))).toEqual({ stock: 9 });
});

it("deletes a variant by id", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValueOnce(jsonResponse(ok(null)));
	vi.stubGlobal("fetch", fetch);

	await deleteVariant("VAR_FISH-NEW");

	const [url, init] = fetch.mock.calls[0];
	expect(new URL(String(url)).pathname).toBe("/api/v1/variants/VAR_FISH-NEW");
	expect(init.method).toBe("DELETE");
});

it("surfaces a duplicate SKU as an ApiError carrying the backend's message", async () => {
	// A duplicate SKU is a 409 whose body is the only thing that tells the user
	// *why*. Verified live: `resource already exists or is still referenced`.
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValueOnce(
		jsonResponse(
			{
				code: 409,
				message: "resource already exists or is still referenced",
				data: null,
			},
			409,
		),
	);
	vi.stubGlobal("fetch", fetch);

	const failure = await createVariant({
		productId: "PRD_172",
		sku: "FISH-PENGUIN-TETRA",
		price: 15000,
		stock: 1,
	}).catch((caught: unknown) => caught);

	expect(failure).toBeInstanceOf(ApiError);
	expect((failure as ApiError).status).toBe(409);
	expect((failure as ApiError).message).toBe(
		"resource already exists or is still referenced",
	);
});
