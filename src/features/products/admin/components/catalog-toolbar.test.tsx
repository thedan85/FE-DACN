import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { CatalogToolbar } from "./catalog-toolbar";

test("resets every catalog filter and clears an unsubmitted search", () => {
	const onChange = vi.fn();
	render(
		<CatalogToolbar
			query={{ keyword: "tetra", category: "fish", status: "DRAFT", sort: "PRICE_ASC", page: 2 }}
			onChange={onChange}
			categories={[]}
			categoriesLoading={false}
			onKeywordSubmit={vi.fn()}
		/>,
	);

	const search = screen.getByRole("textbox", { name: "Search products by name" });
	fireEvent.change(search, { target: { value: "unsubmitted" } });
	fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

	expect(onChange).toHaveBeenCalledExactlyOnceWith({
		keyword: undefined,
		category: undefined,
		status: "ACTIVE",
		sort: "NEWEST",
		page: 1,
	});
	expect((search as HTMLInputElement).value).toBe("");
});
