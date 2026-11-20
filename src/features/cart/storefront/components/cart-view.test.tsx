import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Cart, CartItem } from "../../types";
import { removeCartItem, updateCartItem } from "../../api/cart.api";
import { useCart } from "../hooks/use-cart";
import { CartView } from "./cart-view";
import { stockInterestKey, useStockSnapshots } from "@/features/stock/use-stock-snapshots";
import type { StockSnapshotState } from "@/features/stock/schema";

vi.mock("@/features/stock/use-stock-snapshots", async (importOriginal) => ({
	...await importOriginal<typeof import("@/features/stock/use-stock-snapshots")>(),
	useStockSnapshots: vi.fn(() => new Map()),
}));
vi.mock("../hooks/use-cart", () => ({ useCart: vi.fn() }));
vi.mock("../../api/cart.api", () => ({
	removeCartItem: vi.fn(),
	updateCartItem: vi.fn(),
}));
vi.mock("next/link", () => ({
	default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
		<a href={href} {...rest}>{children}</a>
	),
}));
vi.mock("next/image", () => ({
	default: ({ src, alt }: { src: string; alt: string }) => (
		<img src={src} alt={alt} />
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
	vi.mocked(useStockSnapshots).mockReturnValue(new Map());
	vi.mocked(useCart).mockReturnValue({
		state: { status: "ready", cart },
		reload,
		setCart,
		refresh: vi.fn(),
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

describe("CartView thumbnail gate", () => {
	const allowed =
		"https://res.cloudinary.com/ibk3z2nt/image/upload/v1/guppy.png";
	const unsupported = "https://cdn.example.com/rogue.png";

	function withThumbnail(thumbnail: string): Cart {
		return {
			...cart,
			items: [{ ...cart.items[0]!, thumbnail }],
		};
	}

	function renderWith(thumbnail: string) {
		vi.mocked(useCart).mockReturnValue({
			state: { status: "ready", cart: withThumbnail(thumbnail) },
			reload,
			setCart,
			refresh: vi.fn(),
		});
		return render(<App><CartView /></App>);
	}

	it("renders an allowed catalog thumbnail", () => {
		const { container } = renderWith(allowed);

		expect(container.querySelector(`img[src="${allowed}"]`)).not.toBeNull();
	});

	it("never renders an unsupported thumbnail", () => {
		const { container } = renderWith(unsupported);

		expect(container.querySelector("img")).toBeNull();
		expect(container.innerHTML).not.toContain("cdn.example.com");
	});
});

describe("CartView live availability", () => {
	const lineKey = stockInterestKey({ kind: "variant", productId: "PRD_1", variantId: "VAR_1" });
	const live = (stock: number): StockSnapshotState => ({
		stock, stockRevision: 1, loading: false, error: null, omitted: false,
		readiness: { admission: "admitted", acknowledged: true, status: "live" },
	});

	it("warns and blocks checkout when live stock falls below the line quantity without changing quantity", () => {
		vi.mocked(useStockSnapshots).mockReturnValue(new Map([[lineKey, live(0)]]));
		render(<App><CartView /></App>);

		expect(screen.getByText(/Only 0 left|Out of stock/)).toBeTruthy();
		const link = screen.getByRole("link", { name: /Proceed to Checkout/ });
		expect(link.getAttribute("aria-disabled")).toBe("true");
		expect(screen.getByText(/Adjust or remove items/)).toBeTruthy();
		expect(screen.getByRole("status").textContent).toBe("1");
		expect(updateCartItem).not.toHaveBeenCalled();
	});

	it("unblocks checkout when live stock recovers", () => {
		vi.mocked(useStockSnapshots).mockReturnValue(new Map([[lineKey, live(5)]]));
		render(<App><CartView /></App>);
		const link = screen.getByRole("link", { name: /Proceed to Checkout/ });
		expect(link.getAttribute("aria-disabled")).toBeNull();
		expect(screen.queryByText(/Adjust or remove items/)).toBeNull();
	});
});
