import { afterEach, expect, it, vi } from "vitest";

import {
	addProductAttribute,
	addVariantAttribute,
	listAttributes,
	listAttributeValues,
	removeProductAttribute,
} from "./attributes.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
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

it("reads an attribute's values from the nested path", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(
		ok({
			content: [
				{
					attributeValueId: "temperature-20-28-c",
					attributeId: "temperature",
					attributeName: "Temperature",
					value: "20-28 °C",
					createdAt: "2026-11-01T17:10:51.205759Z",
					updatedAt: "2026-11-01T17:10:51.205759Z",
				},
			],
			page: 0,
			size: 100,
			totalElements: 1,
			totalPages: 1,
		}),
	);

	const values = await listAttributeValues("temperature");

	expect(values).toHaveLength(1);
	expect(values[0]?.value).toBe("20-28 °C");
	expect(new URL(String(fetch.mock.calls[0][0])).pathname).toBe(
		"/api/v1/attributes/temperature/values",
	);
});

/**
 * A truncated attribute list is invisible: the editor would simply never offer
 * the missing values and nothing would report an error. So the reader walks
 * every page the backend says exist.
 */
it("walks every page of a paged catalog resource", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const attribute = {
		attributeId: "temperature",
		name: "Temperature",
		deleted: false,
		createdAt: "2026-11-01T17:10:51.205759Z",
		updatedAt: "2026-11-01T17:10:51.205759Z",
	};
	const fetch = vi.fn();
	fetch
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify(
					ok({
						content: [attribute],
						page: 0,
						size: 100,
						totalElements: 2,
						totalPages: 2,
					}),
				),
			),
		)
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify(
					ok({
						content: [{ ...attribute, attributeId: "color", name: "Color" }],
						page: 1,
						size: 100,
						totalElements: 2,
						totalPages: 2,
					}),
				),
			),
		);
	vi.stubGlobal("fetch", fetch);

	const attributes = await listAttributes();

	expect(attributes.map((entry) => entry.name)).toEqual([
		"Temperature",
		"Color",
	]);
	expect(new URL(String(fetch.mock.calls[1][0])).searchParams.get("page")).toBe(
		"1",
	);
});

it("links a product attribute with the backend's field names", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(
		ok({
			productValueId: "PRD_198-temperature",
			productId: "PRD_198",
			attributeId: "temperature",
			attributeName: "Temperature",
			attributeValueId: "temperature-20-28-c",
			attributeValue: "20-28 °C",
			createdAt: "2026-11-03T15:26:49.477998Z",
		}),
	);

	const link = await addProductAttribute({
		productId: "PRD_198",
		attributeId: "temperature",
		attributeValueId: "temperature-20-28-c",
	});

	expect(link.productValueId).toBe("PRD_198-temperature");
	const [url, init] = fetch.mock.calls[0];
	expect(new URL(String(url)).pathname).toBe("/api/v1/product-attributes");
	expect(JSON.parse(String(init.body))).toEqual({
		productId: "PRD_198",
		attributeId: "temperature",
		attributeValueId: "temperature-20-28-c",
	});
});

it("keeps product and variant links on their own endpoints", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(
		ok({
			variantValueId: "VAR_1-color",
			variantId: "VAR_1",
			attributeId: "color",
			attributeName: "Color",
			attributeValueId: "color-green",
			attributeValue: "Green",
			createdAt: "2026-11-03T15:26:58.150458Z",
		}),
	);

	await addVariantAttribute({
		variantId: "VAR_1",
		attributeId: "color",
		attributeValueId: "color-green",
	});

	expect(new URL(String(fetch.mock.calls[0][0])).pathname).toBe(
		"/api/v1/variant-attributes",
	);
});

it("removes a link by its own id, not the attribute's", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok(null));

	await removeProductAttribute("PRD_198-temperature");

	const [url, init] = fetch.mock.calls[0];
	expect(init.method).toBe("DELETE");
	expect(new URL(String(url)).pathname).toBe(
		"/api/v1/product-attributes/PRD_198-temperature",
	);
});
