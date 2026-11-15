import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { realtimeManager } from "@/features/realtime/connection-manager";
import { clearSession, setAccessToken } from "@/features/auth/session";
import { useAuthStore } from "@/stores/auth-store";
import { stockStore } from "./store";
import { useStockSnapshot } from "./use-stock-snapshot";
import type { StockSnapshotInterest } from "./schema";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("@/lib/env", () => ({ getRealtimePublicEnv: () => null }));
vi.mock("@/lib/api/client", async (original) => ({
	...await original<typeof import("@/lib/api/client")>(), apiFetch: apiFetchMock,
}));
async function settle() {
	await act(async () => { for (let i = 0; i < 60; i += 1) await Promise.resolve(); });
}
const p: StockSnapshotInterest = { kind: "product", productId: "p" };

describe("unmounted shared stock hook", () => {
	beforeEach(() => {
		clearSession();
		useAuthStore.setState({ user: null, status: "anonymous", sessionReady: true });
		apiFetchMock.mockReset();
		apiFetchMock.mockImplementation(async (_: string, init: RequestInit) => {
			const input = JSON.parse(String(init.body)) as { productIds: string[]; variantIds: string[] };
			return { code: 200, message: "OK", data: {
				products: input.productIds.map((productId) => ({ productId, stock: 3 })),
				variants: input.variantIds.map((variantId) => ({ variantId, productId: "parent", stock: 2, stockRevision: 7 })),
			} };
		});
		realtimeManager.start();
	});
	afterEach(async () => {
		cleanup();
		await settle();
		realtimeManager.stop();
		vi.restoreAllMocks();
	});

	it("shares registration/data, keeps subscription reads stable, and releases only the last consumer", async () => {
		const register = vi.spyOn(stockStore, "register");
		const a = renderHook(() => useStockSnapshot(p));
		const b = renderHook(() => useStockSnapshot(p));
		await settle();
		expect(apiFetchMock).toHaveBeenCalledTimes(1);
		expect(register).toHaveBeenCalledTimes(2);
		expect(a.result.current).toBe(b.result.current);
		const state = a.result.current;
		a.rerender();
		expect(a.result.current).toBe(state);
		expect(register).toHaveBeenCalledTimes(2);
		a.unmount();
		await settle();
		expect(b.result.current.stock).toBe(3);
		expect(apiFetchMock).toHaveBeenCalledTimes(1);
		b.unmount();
		await settle();
		act(() => realtimeManager.notifyVisibilityChange());
		await settle();
		expect(apiFetchMock).toHaveBeenCalledTimes(1);
	});

	it("changes resource and variant parent without reusing old data or requesting a parent product total", async () => {
		const initialProps: { interest: StockSnapshotInterest } = { interest: p };
		const hook = renderHook(({ interest }: { interest: StockSnapshotInterest }) => useStockSnapshot(interest), { initialProps });
		await settle();
		hook.rerender({ interest: { kind: "variant", variantId: "v", productId: "parent" } });
		await settle();
		expect(hook.result.current).toMatchObject({ stock: 2, stockRevision: 7 });
		expect(JSON.parse(apiFetchMock.mock.calls.at(-1)![1].body)).toEqual({ productIds: [], variantIds: ["v"] });
		hook.rerender({ interest: { kind: "variant", variantId: "v", productId: "different-parent" } });
		await settle();
		expect(hook.result.current).toMatchObject({ stock: null, omitted: true });
	});

	it("reactively publishes REST/degraded readiness and account-scoped data updates without render loops", async () => {
		const hook = renderHook(() => useStockSnapshot(p));
		await settle();
		expect(hook.result.current.readiness.status).toBe("degraded");
		apiFetchMock.mockResolvedValue({ code: 200, message: "OK", data: {
			products: [{ productId: "p", stock: 8 }], variants: [],
		} });
		act(() => realtimeManager.notifyVisibilityChange());
		await settle();
		expect(hook.result.current.stock).toBe(8);
		act(() => {
			setAccessToken("new-session");
			useAuthStore.setState({ status: "authenticated" });
		});
		expect(hook.result.current.stock).toBeNull();
		await settle();
		expect(hook.result.current.stock).toBe(8);
		expect(hook.result.current.loading).toBe(false);
	});
});
