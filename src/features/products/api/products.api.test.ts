import { afterEach, expect, it, vi } from "vitest";

import {
	getCategories,
	getProductDetailBySlug,
	listProducts,
} from "./products.api";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

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

const productPage = {
	content: [],
	page: 0,
	size: 12,
	totalElements: 0,
	totalPages: 0,
};

const detailFixture = {
	product: {
		productId: "PRD_1",
		slug: "anubias-nana-petite",
		name: "Anubias Nana Petite",
		description: "small",
		detailDescription: "small",
		thumbnail: null,
		thumbnailMediaId: null,
		status: "ACTIVE",
		categoryId: "epiphyte",
		categoryName: "Epiphyte",
		minPrice: null,
		maxPrice: null,
		stock: 0,
		createdAt: "2026-11-03T15:23:59.478285Z",
		updatedAt: "2026-11-03T15:23:59.478285Z",
	},
	attributes: [],
	variants: [],
	reviews: {
		content: [],
		page: 0,
		size: 20,
		totalElements: 0,
		totalPages: 0,
	},
};

it("revalidates public product lists", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok(productPage));

	await listProducts({ sort: "NEWEST", status: "ACTIVE", page: 0, size: 12 });

	expect(fetch.mock.calls[0][1].next).toEqual({ revalidate: 30 });
});

it("revalidates anonymous product detail reads", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok(detailFixture));

	await getProductDetailBySlug("anubias-nana-petite");

	expect(fetch.mock.calls[0][1].next).toEqual({ revalidate: 30 });
});

it("never caches authenticated product detail reads", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok(detailFixture));

	await getProductDetailBySlug(
		"anubias-nana-petite",
		{},
		{ headers: { Authorization: "Bearer staff" } },
	);

	expect(fetch.mock.calls[0][1].next).toBeUndefined();
	expect(fetch.mock.calls[0][1].cache).toBe("no-store");
});

it("does not speculatively fetch a second category page", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(
		ok({
			content: [],
			page: 0,
			size: 100,
			totalElements: 0,
			totalPages: 1,
		}),
	);

	await getCategories();

	expect(fetch).toHaveBeenCalledTimes(1);
});
