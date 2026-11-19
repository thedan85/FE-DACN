import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VariantDetail } from "../../types";
import { ProductVariantGallery } from "./product-variant-gallery";

// Only the URL handed to `next/image` matters here. A plain <img> keeps the
// assertion about what the component chose to render, not about the loader.
vi.mock("next/image", () => ({
	default: ({ src, alt }: { src: string; alt: string }) => (
		<img src={src} alt={alt} />
	),
}));

const allowed =
	"https://res.cloudinary.com/ibk3z2nt/image/upload/v1/guppy.png";
const unsupported = "https://cdn.example.com/rogue.png";

function variantWith(...urls: string[]): VariantDetail {
	return {
		variantId: "VAR_1",
		sku: "GUPPY-1",
		price: 10000,
		stock: 5,
		stockRevision: 0,
		attributes: [],
		media: urls.map((url, index) => ({
			mediaId: `MED_${index}`,
			url,
			productId: null,
			variantId: "VAR_1",
			deleted: false,
			createdAt: "2026-11-06T00:00:00Z",
			updatedAt: "2026-11-06T00:00:00Z",
		})),
	};
}

afterEach(() => cleanup());

describe("ProductVariantGallery media gate", () => {
	it("shows a later allowed image when an earlier entry is unsupported", () => {
		const { container } = render(
			<ProductVariantGallery
				variant={variantWith(unsupported, allowed)}
				productName="Guppy"
			/>,
		);

		expect(screen.getByRole("img", { name: "Guppy" }).getAttribute("src")).toBe(
			allowed,
		);
		expect(container.innerHTML).not.toContain("cdn.example.com");
		expect(screen.queryByText(/image unavailable/i)).toBeNull();
	});

	it("shows the placeholder when every entry is unsupported", () => {
		const { container } = render(
			<ProductVariantGallery
				variant={variantWith(unsupported, "https://other.example/a.png")}
				productName="Guppy"
			/>,
		);

		expect(screen.getByText("No image available")).toBeTruthy();
		expect(container.querySelector("img")).toBeNull();
		expect(container.innerHTML).not.toContain("cdn.example.com");
	});
});
