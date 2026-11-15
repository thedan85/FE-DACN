import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { fetchStockSnapshots } from "./stock.api";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
	...await original<typeof import("@/lib/api/client")>(),
	apiFetch: apiFetchMock,
}));
const empty = { products: [], variants: [] };
const envelope = (data: unknown) => ({ code: 200, message: "OK", data });
beforeEach(() => { apiFetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("stock snapshot API", () => {
	it("uses the shared relative POST, exact deduplicated identities, no-store and cancellation", async () => {
		const data = {
			products: [{ productId: " same ", stock: 0 }],
			variants: [{ variantId: " same ", productId: "parent", stock: 0, stockRevision: 0 }],
		};
		apiFetchMock.mockResolvedValue(envelope(data));
		const signal = new AbortController().signal;
		await expect(fetchStockSnapshots({
			productIds: [" same ", " same "], variantIds: [" same ", " same "],
		}, signal)).resolves.toEqual(data);
		expect(apiFetchMock).toHaveBeenCalledExactlyOnceWith("stock/snapshots", {
			method: "POST", body: JSON.stringify({ productIds: [" same "], variantIds: [" same "] }),
			cache: "no-store", signal,
		});
	});

	it.each([
		{ productIds: ["p"], variantIds: [] },
		{ productIds: [], variantIds: ["v"] },
		{ productIds: Array(101).fill("same"), variantIds: ["same"] },
	])("accepts empty roles, omissions and combined deduplication: %j", async (input) => {
		apiFetchMock.mockResolvedValue(envelope(empty));
		await expect(fetchStockSnapshots(input)).resolves.toEqual(empty);
		expect(apiFetchMock).toHaveBeenCalledTimes(1);
	});

	it.each([
		{ productIds: [], variantIds: [] },
		{ productIds: ["p"], variantIds: Array.from({ length: 100 }, (_, i) => `v${i}`) },
		{ productIds: [" \t"], variantIds: [] },
		{ productIds: [], variantIds: ["x".repeat(256)] },
		{ productIds: ["p"] },
		{ variantIds: ["v"] },
	])("rejects invalid input before HTTP: %j", async (input) => {
		await expect(fetchStockSnapshots(input as Parameters<typeof fetchStockSnapshots>[0])).rejects.toThrow();
		expect(apiFetchMock).not.toHaveBeenCalled();
	});

	it.each([
		null, {}, { products: [] }, { products: [], variants: null },
		{ products: [{ productId: "", stock: 1 }], variants: [] },
		{ products: [{ productId: "p", stock: -1 }], variants: [] },
		{ products: [{ productId: "p", stock: "0" }], variants: [] },
		{ products: [], variants: [{ variantId: "v", productId: " ", stock: 0, stockRevision: 0 }] },
		{ products: [], variants: [{ variantId: "v", productId: "p", stock: 0, stockRevision: -1 }] },
		{ products: [], variants: [{ variantId: "v", productId: "p", stock: 0 }] },
	])("rejects malformed success: %j", async (data) => {
		apiFetchMock.mockResolvedValue(envelope(data));
		await expect(fetchStockSnapshots({ productIds: ["p"], variantIds: [] })).rejects.toMatchObject({ status: 500 });
	});

	it.each([503, 0])(
		"propagates existing errors without auth retries: %s", async (status) => {
			const error = new ApiError("unavailable", status);
			apiFetchMock.mockRejectedValue(error);
			await expect(fetchStockSnapshots({ productIds: ["p"], variantIds: [] })).rejects.toBe(error);
			expect(apiFetchMock).toHaveBeenCalledTimes(1);
		},
	);

	it("uses the actual shared client for HTTP errors, without a refresh or real network", async () => {
		vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://local.invalid/api/v1");
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ message: "busy" }), { status: 503 }));
		vi.stubGlobal("fetch", fetchMock);
		const { apiFetch } = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
		apiFetchMock.mockImplementation(apiFetch);
		await expect(fetchStockSnapshots({ productIds: ["p"], variantIds: [] })).rejects.toMatchObject({ status: 503, message: "busy" });
		expect(String(fetchMock.mock.calls[0][0])).toBe("https://local.invalid/api/v1/stock/snapshots");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("keeps actual shared-client network failures in the existing status-0 convention", async () => {
		vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://local.invalid/api/v1");
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
		const { apiFetch } = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
		apiFetchMock.mockImplementation(apiFetch);
		await expect(fetchStockSnapshots({ productIds: [], variantIds: ["v"] })).rejects.toMatchObject({ status: 0 });
	});
});
