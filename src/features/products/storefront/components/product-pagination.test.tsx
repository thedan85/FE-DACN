import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ProductPagination } from "./product-pagination";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

it("requests scroll to top when changing pages without losing the catalog query", () => {
	vi.stubGlobal("matchMedia", () => ({
		matches: false,
		addListener() {},
		removeListener() {},
		addEventListener() {},
		removeEventListener() {},
	}));
	render(
		<ProductPagination
			query={{
				name: "fish",
				category: "livestock",
				sort: "price_asc",
				minPrice: 10000,
				page: 1,
			}}
			page={1}
			pageSize={12}
			total={36}
		/>,
	);

	fireEvent.click(screen.getByRole("button", { name: "right" }));

	expect(replace).toHaveBeenCalledWith(
		"/products?name=fish&category=livestock&sort=price_asc&min_price=10000&page=2",
		{ scroll: true },
	);
});
