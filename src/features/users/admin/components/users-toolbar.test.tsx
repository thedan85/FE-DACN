import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_USERS_LISTING_QUERY } from "../model/listing-query";
import { UsersToolbar } from "./users-toolbar";
import type { Role } from "../schema/user.schema";

const catalog: Role[] = [
	{ roleId: "r-employee", code: "employee", name: "Employee", description: null, system: true },
	{ roleId: "r-admin", code: "admin", name: "Administrator", description: null, system: true },
	{ roleId: "r-customer", code: "customer", name: "Customer", description: null, system: true },
	{ roleId: "r-customer-caps", code: "CUSTOMER", name: "Customer (caps)", description: null, system: false },
];

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

it("staff mode dropdown never offers the customer role or an all-roles escape", async () => {
	render(<UsersToolbar
		query={{ ...DEFAULT_USERS_LISTING_QUERY, roleCode: "employee" }}
		roles={catalog} rolesLoading={false} rolesFallback={false}
		staff
		onChange={vi.fn()} onKeywordSubmit={vi.fn()}
	/>);
	const select = screen.getByRole("combobox", { name: "Filter by role" });
	fireEvent.mouseDown(select);
	const options = await screen.findAllByRole("option");
	// antd v6 renders the value as the option's text and the label as its
	// accessible name, so assert on the name.
	const labels = options.map((option) => option.getAttribute("aria-label"));
	expect(labels).toContain("Employee");
	expect(labels).toContain("Administrator");
	expect(labels).not.toContain("Customer");
	expect(labels).not.toContain("Customer (caps)");
	expect(labels).not.toContain("All roles");
});
