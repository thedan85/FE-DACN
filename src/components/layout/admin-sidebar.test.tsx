import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";
import { AdminSidebar } from "./admin-sidebar";

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

it("links Staff & Permissions to the roles page with role:read", () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["role:read"] },
	});
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.getByRole("link", { name: "Staff & Permissions" }).getAttribute("href"))
		.toBe("/admin/roles");
});

it("hides Staff & Permissions without role:read", () => {
	useAuthStore.setState({ status: "authenticated", user: { ...user, permissions: [] } });
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.queryByRole("link", { name: "Staff & Permissions" })).toBeNull();
});

it("links User accounts to the users page with user:read", () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["user:read"] },
	});
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.getByRole("link", { name: "User accounts" }).getAttribute("href"))
		.toBe("/admin/users");
});

it("hides User accounts without user:read", () => {
	useAuthStore.setState({ status: "authenticated", user: { ...user, permissions: [] } });
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.queryByRole("link", { name: "User accounts" })).toBeNull();
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

it("links Reviews with review:read", () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["review:read"] },
	});
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.getByRole("link", { name: "Reviews" }).getAttribute("href"))
		.toBe("/admin/reviews");
});

it("hides Reviews without review:read", () => {
	useAuthStore.setState({ status: "authenticated", user: { ...user, permissions: [] } });
	render(<AdminSidebar collapsed={false} onToggleCollapse={vi.fn()} />);
	expect(screen.queryByRole("link", { name: "Reviews" })).toBeNull();
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

it("keeps an accessible name on every link when collapsed", () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["order:read", "user:read", "role:read", "review:read"] },
	});
	render(<AdminSidebar collapsed onToggleCollapse={vi.fn()} />);

	// The collapsed rail hides the label text, so the name must come from the
	// link itself; a label that only exists as visible text is not a name.
	for (const name of [
		"Dashboard",
		"Orders",
		"Products & Variants",
		"Categories",
		"Attributes",
		"Media",
		"Customers",
		"Reviews",
		"Staff & Permissions",
		"User accounts",
		"View storefront",
	]) {
		const link = screen.getByRole("link", { name });
		expect(link.getAttribute("aria-label"), name).toBeTruthy();
	}
});

it("keeps the collapse control named when collapsed", () => {
	render(<AdminSidebar collapsed onToggleCollapse={vi.fn()} />);
	expect(
		screen.getByRole("button", { name: "Expand sidebar" }),
	).toBeTruthy();
});
