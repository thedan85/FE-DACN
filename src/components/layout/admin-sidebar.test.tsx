import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";
import { AdminSidebar } from "./admin-sidebar";
import { PAGE_TITLES } from "./admin-layout";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/dashboard" }));

const user = {
	userId: "USR_1",
	email: "staff@example.com",
	name: "Staff",
	phone: null,
	address: null,
	roleCode: "STAFF",
	roleName: "Staff",
	permissions: ["order:read"],
	hasPassword: true,
};

beforeEach(() => {
	useAuthStore.setState({ status: "authenticated", user });
});

afterEach(cleanup);

it("links Orders when the account can read orders", () => {
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.getByRole("link", { name: "Orders" }).getAttribute("href"))
		.toBe("/admin/orders");
});

it("hides Orders without order:read", () => {
	useAuthStore.setState({ status: "authenticated", user: { ...user, permissions: [] } });
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.queryByRole("link", { name: "Orders" })).toBeNull();
});

it("links Staff & Permissions when the account can read users", () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["user:read"] },
	});
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.getByRole("link", { name: "Staff & Permissions" }).getAttribute("href"))
		.toBe("/admin/staff");
});

it("hides Staff & Permissions without user:read", () => {
	useAuthStore.setState({ status: "authenticated", user: { ...user, permissions: [] } });
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.queryByRole("link", { name: "Staff & Permissions" })).toBeNull();
});

it("links Customers with user:read", () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["user:read"] },
	});
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.getByRole("link", { name: "Customers" }).getAttribute("href"))
		.toBe("/admin/customers");
});

it("hides Customers without user:read", () => {
	useAuthStore.setState({ status: "authenticated", user: { ...user, permissions: [] } });
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.queryByRole("link", { name: "Customers" })).toBeNull();
});

it("renders the three catalog links without permissions", () => {
	useAuthStore.setState({ status: "authenticated", user: { ...user, permissions: [] } });
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.getByRole("link", { name: "Categories" }).getAttribute("href"))
		.toBe("/admin/categories");
	expect(screen.getByRole("link", { name: "Attributes" }).getAttribute("href"))
		.toBe("/admin/attributes");
	expect(screen.getByRole("link", { name: "Media" }).getAttribute("href"))
		.toBe("/admin/media");
});

it("has a PAGE_TITLES row for each of the five new labels", () => {
	for (const entry of [
		{ href: "/admin/staff", title: "Staff & Permissions" },
		{ href: "/admin/customers", title: "Customers" },
		{ href: "/admin/categories", title: "Categories" },
		{ href: "/admin/attributes", title: "Attributes" },
		{ href: "/admin/media", title: "Media" },
	]) {
		expect(
			PAGE_TITLES.some(
				(row) => row.href === entry.href && row.title === entry.title,
			),
		).toBe(true);
	}
});
