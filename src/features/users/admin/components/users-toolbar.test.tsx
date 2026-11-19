import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_USERS_LISTING_QUERY } from "../model/listing-query";
import { UsersToolbar } from "./users-toolbar";

beforeEach(() => {
	vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows the selected role filter in both the closed control and dropdown when the catalog lacks it", async () => {
	render(<UsersToolbar
		query={{ ...DEFAULT_USERS_LISTING_QUERY, roleCode: "missing_custom" }}
		roles={[]} rolesLoading={false} rolesFallback
		onChange={vi.fn()} onKeywordSubmit={vi.fn()}
	/>);
	const select = screen.getByRole("combobox", { name: "Filter by role" });
	expect(select.closest(".ant-select")?.textContent).toContain("missing_custom");
	fireEvent.mouseDown(select);
	expect(await screen.findByRole("option", { name: "missing_custom" })).toBeTruthy();
});
