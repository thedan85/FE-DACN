import type { ReactNode } from "react";

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";

import { listAdminPermissions, listAdminRoles } from "../api/admin-roles.api";
import { listAdminUsers } from "../api/admin-users.api";
import { StaffPermissionsView } from "./staff-permissions-view";

const nav = vi.hoisted(() => {
	const replace = vi.fn();
	// A module-level instance: a fresh object per call would re-fire effects
	// that list the router as a dependency.
	return { search: "", replace, router: { replace } };
});

vi.mock("next/navigation", () => ({
	useRouter: () => nav.router,
	usePathname: () => "/admin/staff",
	useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("../api/admin-users.api", () => ({
	listAdminUsers: vi.fn(),
	getAdminUser: vi.fn(),
	createAdminUser: vi.fn(),
	setAdminUserStatus: vi.fn(),
	setAdminUserRole: vi.fn(),
	deleteAdminUser: vi.fn(),
}));

vi.mock("../api/admin-roles.api", () => ({
	listAdminRoles: vi.fn(),
	getAdminRole: vi.fn(),
	listAdminPermissions: vi.fn(),
	createAdminRole: vi.fn(),
	patchAdminRole: vi.fn(),
	replaceAdminRolePermissions: vi.fn(),
	deleteAdminRole: vi.fn(),
}));

vi.mock("@/features/products/admin/components/admin-catalog-theme", () => ({
	AdminCatalogTheme: ({ children }: { children: ReactNode }) => (
		<div data-testid="admin-catalog-theme">{children}</div>
	),
}));

const user = {
	userId: "USR_ADMIN",
	email: "admin@example.com",
	name: "Admin Actor",
	phone: null,
	address: null,
	roleCode: "admin",
	roleName: "Administrator",
	permissions: ["user:read", "role:read"],
	hasPassword: true,
};

async function flush() {
	await act(async () => {
		await Promise.resolve();
	});
}

function renderView() {
	return render(
		<App>
			<StaffPermissionsView />
		</App>,
	);
}

beforeEach(() => {
	nav.search = "";
	nav.replace.mockReset();
	useAuthStore.setState({ status: "authenticated", user });
	// antd's responsive pieces read these; jsdom provides neither.
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockReturnValue({
			matches: false,
			addListener() {},
			removeListener() {},
			addEventListener() {},
			removeEventListener() {},
		}),
	);
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	vi.mocked(listAdminUsers).mockReset().mockResolvedValue({
		content: [],
		page: 0,
		size: 20,
		totalElements: 0,
		totalPages: 0,
	});
	vi.mocked(listAdminRoles).mockReset().mockResolvedValue([]);
	vi.mocked(listAdminPermissions).mockReset().mockResolvedValue([]);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

it("rolesOnlyAccount_neverRequestsUsers", async () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["role:read"] },
	});
	nav.search = "tab=staff";

	renderView();
	await flush();

	expect(listAdminUsers).not.toHaveBeenCalled();
	expect(
		screen.queryByRole("tab", { name: "Staff" }),
	).toBeNull();
	expect(screen.getByRole("tab", { name: "Roles" })).toBeTruthy();
	expect(
		screen.getByRole("heading", { name: "Roles & Permissions" }),
	).toBeTruthy();
});

it("userReadOnlyAccount_seesOnlyStaffTab", async () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["user:read"] },
	});

	renderView();
	await flush();

	expect(listAdminUsers).toHaveBeenCalled();
	expect(listAdminRoles).not.toHaveBeenCalled();
	expect(
		screen.queryByRole("tab", { name: "Roles" }),
	).toBeNull();
	expect(screen.getByRole("tab", { name: "Staff" })).toBeTruthy();
});

it("accountWithoutAnyReadPermission_seesAccessDenied", async () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: [] },
	});

	renderView();
	await flush();

	expect(listAdminUsers).not.toHaveBeenCalled();
	expect(listAdminRoles).not.toHaveBeenCalled();
	expect(screen.getByText(/role:read/)).toBeTruthy();
});

it("inaccessibleRequestedTab_fallsBackToFirstAccessibleTab", async () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["user:read"] },
	});
	nav.search = "tab=roles";

	renderView();
	await flush();

	expect(listAdminRoles).not.toHaveBeenCalled();
	expect(
		screen.getByRole("tab", { name: "Staff" }).getAttribute("aria-selected"),
	).toBe("true");
});

it("switchingTabs_routesThroughTheUrl", async () => {
	renderView();
	await flush();

	fireEvent.click(screen.getByRole("tab", { name: "Roles" }));

	expect(nav.replace).toHaveBeenCalledWith("/admin/staff?tab=roles");
});
