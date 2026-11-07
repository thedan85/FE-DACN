import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Cart, CartItem } from "../../types";
import { removeCartItem, updateCartItem } from "../../api/cart.api";
import { useCart } from "../hooks/use-cart";
import { CartView } from "./cart-view";

vi.mock("../hooks/use-cart", () => ({ useCart: vi.fn() }));
vi.mock("../../api/cart.api", () => ({
	removeCartItem: vi.fn(),
	updateCartItem: vi.fn(),
}));
vi.mock("next/link", () => ({
	default: ({ href, children }: { href: string; children: ReactNode }) => (
		<a href={href}>{children}</a>
	),
}));

const cart: Cart = {
	cartId: "CART_1",
	customerId: "CUS_1",
	customerName: "Jane",
	items: [
		{
			cartItemId: "CI_1",
			cartId: "CART_1",
			variantId: "VAR_1",
			sku: "FISH-GUPPY",
			quantity: 1,
			price: 10000,
			lineTotal: 10000,
			productId: "PRD_1",
			productName: "Guppy",
			thumbnail: null,
			stock: 5,
			createdAt: "2026-11-06T00:00:00Z",
			updatedAt: "2026-11-06T00:00:00Z",
		},
	],
	compatibility: {
		verdict: "CAUTION",
		summary: "Some species need monitoring before cohabitation.",
		checks: [
			{
				code: "TEMPERATURE",
				status: "WARN",
				message: "Shared temperature range is only 24-26 °C.",
			},
		],
		recommendedTankLitres: 75,
	},
	totalQuantity: 1,
	totalAmount: 10000,
	createdAt: "2026-11-06T00:00:00Z",
	updatedAt: "2026-11-06T00:00:00Z",
};

const reload = vi.fn();
const setCart = vi.fn();
const updatedItem: CartItem = { ...cart.items[0], quantity: 2, lineTotal: 20000 };

beforeEach(() => {
	vi.mocked(removeCartItem).mockReset().mockResolvedValue(undefined);
	vi.mocked(updateCartItem).mockReset().mockResolvedValue(updatedItem);
	reload.mockReset();
	setCart.mockReset();
	vi.mocked(useCart).mockReturnValue({
		state: { status: "ready", cart },
		reload,
		setCart,
	});
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
		matches: false,
		addListener() {},
		removeListener() {},
		addEventListener() {},
		removeEventListener() {},
	}));
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("CartView compatibility", () => {
	it("renders the computed verdict and reasons", () => {
		render(<App><CartView /></App>);

		expect(screen.getByText("Caution")).toBeTruthy();
		expect(
			screen.getByText("Shared temperature range is only 24-26 °C."),
		).toBeTruthy();
		expect(screen.queryByText(/100% Cohabitation Safe/)).toBeNull();
		expect(screen.queryByText(/22–26°C/)).toBeNull();
	});

	it("refetches the cart after removing an item", async () => {
		render(<App><CartView /></App>);

		fireEvent.click(
			screen.getByRole("button", { name: "Remove Guppy from cart" }),
		);

		await waitFor(() => expect(removeCartItem).toHaveBeenCalledWith("CI_1"));
		await waitFor(() => expect(reload).toHaveBeenCalled());
		expect(setCart).not.toHaveBeenCalled();
	});

	it("keeps the verdict when quantity changes", async () => {
		render(<App><CartView /></App>);

		fireEvent.click(
			screen.getByRole("button", { name: "Increase quantity for Guppy" }),
		);

		await waitFor(() => expect(updateCartItem).toHaveBeenCalledWith("CI_1", 2));
		await waitFor(() => expect(setCart).toHaveBeenCalled());
		expect(reload).not.toHaveBeenCalled();
		const nextCart = setCart.mock.calls[0][0] as Cart;
		expect(nextCart.compatibility).toBe(cart.compatibility);
		expect(screen.getByText("Caution")).toBeTruthy();
	});
});
