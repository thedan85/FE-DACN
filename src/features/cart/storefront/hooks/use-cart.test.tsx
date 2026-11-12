import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";

import { getCart } from "../../api/cart.api";
import type { Cart } from "../../types";
import { useCart } from "./use-cart";

vi.mock("../../api/cart.api", () => ({ getCart: vi.fn() }));

const cart: Cart = {
	cartId: "CART_1",
	customerId: "CUS_1",
	customerName: "Customer",
	items: [],
	compatibility: {
		verdict: "INFO",
		summary: "Add another fish species.",
		checks: [],
		recommendedTankLitres: null,
	},
	totalQuantity: 0,
	totalAmount: 0,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
};

describe("useCart", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useAuthStore.setState({
			user: null,
			status: "loading",
			sessionReady: true,
			hydrate: vi.fn().mockResolvedValue(undefined),
		});
	});

	afterEach(() => {
		cleanup();
	});

	it("loads the cart as soon as the session is ready", async () => {
		vi.mocked(getCart).mockResolvedValue(cart);

		const { result } = renderHook(() => useCart());

		await waitFor(() => {
			expect(getCart).toHaveBeenCalledTimes(1);
		});
		await waitFor(() => {
			expect(result.current.state).toEqual({ status: "ready", cart });
		});
	});

	it("does not refetch when the profile resolves after the cart", async () => {
		useAuthStore.setState({ sessionReady: false });
		vi.mocked(getCart).mockResolvedValue(cart);

		const { unmount } = renderHook(() => useCart());

		act(() => {
			useAuthStore.setState({ sessionReady: true });
		});
		await waitFor(() => {
			expect(getCart).toHaveBeenCalledTimes(1);
		});

		act(() => {
			useAuthStore.setState({ status: "authenticated" });
		});
		await waitFor(() => {
			expect(useAuthStore.getState().status).toBe("authenticated");
		});
		expect(getCart).toHaveBeenCalledTimes(1);
		unmount();
	});
});
