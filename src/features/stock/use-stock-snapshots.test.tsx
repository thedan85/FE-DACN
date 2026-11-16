import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearSession, setAccessToken } from "@/features/auth/session";
import { useAuthStore } from "@/stores/auth-store";
import { useStockSnapshots, stockInterestKey } from "./use-stock-snapshots";
import { useStockSnapshot } from "./use-stock-snapshot";
import { effectiveStock } from "./model/effective-stock";
import type { StockSnapshotInterest } from "./schema";

const { apiFetchMock, manager } = vi.hoisted(() => ({
	apiFetchMock: vi.fn(),
	manager: {
		start: vi.fn(),
		stop: vi.fn(),
		subscribeStock: vi.fn(() => () => {}),
		onInterestState: vi.fn(() => () => {}),
		getInterestState: vi.fn(() => ({ admission: "admitted", acknowledged: true, status: "live" })),
		onReconcile: vi.fn(() => () => {}),
	},
}));
vi.mock("@/features/realtime/connection-manager", () => ({
	realtimeManager: manager,
	RealtimeConnectionManager: class {},
}));
vi.mock("@/lib/api/client", async (original) => ({
	...await original<typeof import("@/lib/api/client")>(), apiFetch: apiFetchMock,
}));

type Input = { productIds: string[]; variantIds: string[] };
const product = (productId: string): StockSnapshotInterest => ({ kind: "product", productId });
const variant = (variantId: string, productId = "parent"): StockSnapshotInterest =>
	({ kind: "variant", productId, variantId });
const payload = (input: Input, stock = 4) => ({
	code: 200, message: "OK", data: {
		products: input.productIds.map((productId) => ({ productId, stock })),
		variants: input.variantIds.map((variantId) => ({ variantId, productId: "parent", stock, stockRevision: stock })),
	},
});
async function settle() {
	await act(async () => { for (let i = 0; i < 60; i += 1) await Promise.resolve(); });
}

beforeEach(() => {
	clearSession();
	useAuthStore.setState({ user: null, status: "anonymous", sessionReady: true });
	apiFetchMock.mockReset();
	apiFetchMock.mockImplementation(async (_: string, init: RequestInit) =>
		payload(JSON.parse(String(init.body)) as Input));
	manager.subscribeStock.mockClear();
	manager.getInterestState.mockReturnValue({ admission: "admitted", acknowledged: true, status: "live" });
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("plural stock snapshot hook", () => {
	it("registers every interest through the shared store with one batched REST snapshot", async () => {
		const interests = Array.from({ length: 25 }, (_, i) => product(`p${i}`));
		const hook = renderHook(({ list }) => useStockSnapshots(list), { initialProps: { list: interests } });
		await settle();
		expect(manager.subscribeStock).toHaveBeenCalledTimes(25);
		expect(apiFetchMock).toHaveBeenCalledTimes(1);
		const body = JSON.parse(String(apiFetchMock.mock.calls[0][1].body)) as Input;
		expect(body.productIds).toHaveLength(25);
		expect(hook.result.current.size).toBe(25);
		for (const interest of interests) {
			expect(effectiveStock(hook.result.current.get(stockInterestKey(interest)), 9)).toBe(4);
		}
	});

	it("batches 25 separate card islands into one REST snapshot with no per-card request", async () => {
		const hooks = Array.from({ length: 25 }, (_, i) =>
			renderHook(() => useStockSnapshot(product(`card${i}`))));
		await settle();
		expect(manager.subscribeStock).toHaveBeenCalledTimes(25);
		expect(apiFetchMock).toHaveBeenCalledTimes(1);
		const body = JSON.parse(String(apiFetchMock.mock.calls[0][1].body)) as Input;
		expect(body.productIds).toHaveLength(25);
		for (const hook of hooks) hook.unmount();
		await settle();
	});

	it("returns a referentially stable snapshot and never renders in a loop", async () => {
		const interests = [variant("v1"), variant("v2")];
		const hook = renderHook(({ list }) => useStockSnapshots(list), { initialProps: { list: interests } });
		await settle();
		const first = hook.result.current;
		hook.rerender({ list: [...interests] }); // new array, same interests
		expect(hook.result.current).toBe(first);
		hook.rerender({ list: interests });
		expect(hook.result.current).toBe(first);
		expect(apiFetchMock).toHaveBeenCalledTimes(1);
	});

	it("does not reuse a previous product's live stock after product/variant change", async () => {
		const hook = renderHook(({ list }) => useStockSnapshots(list), {
			initialProps: { list: [product("OLD")] },
		});
		await settle();
		expect(effectiveStock(hook.result.current.get(stockInterestKey(product("OLD"))), 9)).toBe(4);
		hook.rerender({ list: [product("NEW")] });
		await settle();
		expect(hook.result.current.has(stockInterestKey(product("OLD")))).toBe(false);
		expect(hook.result.current.get(stockInterestKey(product("NEW")))).toMatchObject({ stock: 4 });
		expect(effectiveStock(hook.result.current.get(stockInterestKey(product("NEW"))), 9)).toBe(4);
	});

	it("resets stock state on account/session change", async () => {
		setAccessToken("before");
		const hook = renderHook(({ list }) => useStockSnapshots(list), { initialProps: { list: [product("p")] } });
		await settle();
		expect(effectiveStock(hook.result.current.get(stockInterestKey(product("p"))), 9)).toBe(4);
		act(() => {
			setAccessToken("after");
			useAuthStore.setState({ status: "authenticated" });
		});
		expect(hook.result.current.get(stockInterestKey(product("p")))).toMatchObject({ stock: null, omitted: false });
		await settle();
		// A fresh read repopulates the new account's slot.
		expect(hook.result.current.get(stockInterestKey(product("p")))).toMatchObject({ stock: 4 });
	});
});
