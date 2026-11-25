import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth-store";
import { AdminLayout } from "./admin-layout";

const route = vi.hoisted(() => ({ pathname: "/admin/dashboard" }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useRouter: () => router }));
// Notification transport has its own tests; these regressions exercise the real shell/header/sidebar.
vi.mock("@/features/notifications/components/notification-bell", () => ({ NotificationBell: () => null }));

beforeEach(() => {
	route.pathname = "/admin/dashboard";
	useAuthStore.setState({ status: "authenticated", user: {
		userId: "actor", name: "Actor", email: "actor@example.com", phone: null, address: null,
		roleCode: "employee", roleName: "Employee", permissions: ["order:read", "user:read", "role:read"], hasPassword: true,
	} });
	vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
	vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
		matches: query === "(max-width: 900px)", media: query,
		addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
	})));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "anonymous" }); });

function shell() { return <App><AdminLayout><p>Page content</p></AdminLayout></App>; }

it.each([
	["/admin/dashboard", "Dashboard", null],
	["/admin/orders/order-42", "Orders", null],
	["/admin/notifications", "Notifications", null],
	["/admin/products/fish/edit", "Products & Variants", null],
	["/admin/users", "User accounts", null],
	["/admin/users/new", "Add user", "User accounts"],
	["/admin/users/user-42", "User detail", "User accounts"],
	["/admin/users/user-42/edit", "Edit user", "User accounts"],
	["/admin/roles", "Roles & permissions", null],
	["/admin/roles/new", "Add role", "Roles & permissions"],
	["/admin/roles/role-42", "Role detail", "Roles & permissions"],
	["/admin/staff", "Staff & Permissions", null],
	["/admin/customers", "Customers", null],
	["/admin/reviews", "Reviews", null],
	["/admin/categories", "Categories", null],
	["/admin/attributes", "Attributes", null],
	["/admin/media", "Media", null],
])("preserves the combined branches' breadcrumb for %s", (pathname, title, parent) => {
	route.pathname = pathname;
	render(shell());
	const crumb = within(screen.getByRole("navigation", { name: "Breadcrumb" }));
	expect(crumb.getByText(title).getAttribute("aria-current")).toBe("page");
	if (parent) expect(crumb.getByText(parent)).toBeTruthy();
	expect(screen.getByRole("main").textContent).toContain("Page content");
});

it("opens the mobile navigation and closes it after choosing a merged-in destination", () => {
	render(shell());
	const toggle = screen.getByRole("button", { name: "Open navigation" });
	fireEvent.click(toggle);
	expect(toggle.getAttribute("aria-expanded")).toBe("true");
	const drawer = within(screen.getByRole("dialog"));
	expect(drawer.getByRole("link", { name: "Staff & Permissions" }).getAttribute("href")).toBe("/admin/roles");
	fireEvent.click(drawer.getByRole("link", { name: "User accounts" }));
	expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

it("closes mobile navigation on route changes while updating the breadcrumb", () => {
	const view = render(shell());
	fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
	route.pathname = "/admin/users/new";
	view.rerender(shell());
	expect(screen.getByRole("button", { name: "Open navigation" }).getAttribute("aria-expanded")).toBe("false");
	expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("Add user")).toBeTruthy();
});
