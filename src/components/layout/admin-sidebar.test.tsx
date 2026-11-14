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
