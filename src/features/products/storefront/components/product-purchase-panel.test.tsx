import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addToCart } from "@/features/cart/api/cart.api";
import { useAuthStore } from "@/stores/auth-store";
import type { VariantDetail } from "../../types";
import { ProductPurchasePanel } from "./product-purchase-panel";

vi.mock("@/features/cart/api/cart.api", () => ({ addToCart: vi.fn() }));

const variant: VariantDetail = {
	variantId: "VAR_1",
	sku: "GUPPY",
	price: 10000,
	stock: 5,
	stockRevision: 1,
	attributes: [],
	media: [],
};

beforeEach(() => {
	vi.mocked(addToCart).mockReset().mockResolvedValue({
		status: "added",
		item: {
			cartItemId: "CI_1", cartId: "CART_1", variantId: "VAR_1", sku: "GUPPY",
			quantity: 1, price: 10000, lineTotal: 10000, productId: "PRD_1",
			productName: "Guppy", thumbnail: null, stock: 5,
			createdAt: "2026-11-11T10:00:00Z", updatedAt: "2026-11-11T10:00:00Z",
		},
	});
	useAuthStore.setState({ status: "authenticated", user: null });
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
		matches: false, addListener() {}, removeListener() {},
		addEventListener() {}, removeEventListener() {},
	}));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function addButton() {
	return screen.getByRole("button", { name: "ADD TO CART" }) as HTMLButtonElement;
}

describe("ProductPurchasePanel live availability", () => {
	it("warns and disables Add to Cart when live stock drops below the chosen quantity, without changing quantity", () => {
		const { rerender } = render(<App><ProductPurchasePanel variant={variant} effectiveStock={5} /></App>);
		fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
		fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
		expect(screen.getByText("3")).toBeTruthy();

		rerender(<App><ProductPurchasePanel variant={variant} effectiveStock={1} /></App>);

		expect(screen.getByText(/Only 1 left/)).toBeTruthy();
		expect(addButton().disabled).toBe(true);
		expect(screen.getByText("3")).toBeTruthy(); // never silently reduced
		expect(addToCart).not.toHaveBeenCalled();
	});

	it("shows out of stock and blocks submission on a live zero, then allows more units when stock rises", () => {
		const { rerender } = render(<App><ProductPurchasePanel variant={variant} effectiveStock={0} /></App>);
		expect(screen.getByText("This variant is out of stock.")).toBeTruthy();
		expect(addButton().disabled).toBe(true);

		rerender(<App><ProductPurchasePanel variant={variant} effectiveStock={4} /></App>);
		expect(screen.queryByText("This variant is out of stock.")).toBeNull();
		expect(addButton().disabled).toBe(false);
		fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
		expect(screen.getByText("2")).toBeTruthy();
	});

	it("does not let the stepper exceed effective live stock", () => {
		render(<App><ProductPurchasePanel variant={variant} effectiveStock={2} /></App>);
		fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
		fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
		expect(screen.getByText("2")).toBeTruthy();
		expect((screen.getByRole("button", { name: "Increase quantity" }) as HTMLButtonElement).disabled).toBe(true);
	});
});
