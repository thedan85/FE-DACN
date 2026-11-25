import { afterEach, expect, it, vi } from "vitest";

import { deleteAdminReview, listAdminReviews } from "./admin-reviews.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

const review = {
	reviewId: "REV_1",
	customerId: "CUS_1",
	customerName: "An",
	rating: 5,
	comment: "great",
	productId: "PRD_1",
	productName: "Cichlid",
	variantId: "VAR_1",
	variantSku: "SKU-1",
	verifiedPurchase: true,
	createdAt: "2026-11-20T10:00:00Z",
	updatedAt: "2026-11-20T10:00:00Z",
};

it("lists reviews with trimmed keyword and rating", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(
		new Response(JSON.stringify({
			code: 200,
			message: "OK",
			data: { content: [review], page: 0, size: 20, totalElements: 1, totalPages: 1 },
		}), { headers: { "Content-Type": "application/json" } }),
	);
	vi.stubGlobal("fetch", fetch);

	const page = await listAdminReviews({
		page: 0, size: 20, keyword: "  cichlid  ", rating: 5,
	});

	const url = new URL(String(fetch.mock.calls[0][0]));
	expect(url.pathname).toBe("/api/v1/admin/reviews");
	expect(url.searchParams.get("keyword")).toBe("cichlid");
	expect(url.searchParams.get("rating")).toBe("5");
	expect(page.content[0].productName).toBe("Cichlid");
});

it("deletes a review with an encoded id", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(
		new Response(JSON.stringify({ code: 200, message: "OK", data: null }), {
			headers: { "Content-Type": "application/json" },
		}),
	);
	vi.stubGlobal("fetch", fetch);

	await deleteAdminReview("REV/1");

	const [input, init] = fetch.mock.calls[0] as [string, RequestInit];
	expect(new URL(String(input)).pathname).toBe("/api/v1/admin/reviews/REV%2F1");
	expect(init.method).toBe("DELETE");
});
