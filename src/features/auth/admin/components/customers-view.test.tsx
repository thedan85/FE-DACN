import type { ReactNode } from "react";

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

import {
	getAdminUser,
	listAdminUsers,
	setAdminUserStatus,
} from "../api/admin-users.api";
import type { AdminUser, AdminUserDetail } from "../schema/admin-users.schema";
import { CustomersView } from "./customers-view";

const nav = vi.hoisted(() => {
	const replace = vi.fn();
	// A module-level instance: a fresh object per call would re-fire effects
	// that list the router as a dependency.
	return { search: "", replace, router: { replace } };
});

vi.mock("next/navigation", () => ({
	useRouter: () => nav.router,
	usePathname: () => "/admin/customers",
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

vi.mock("@/features/products/admin/components/admin-catalog-theme", () => ({
	AdminCatalogTheme: ({ children }: { children: ReactNode }) => (
		<div data-testid="admin-catalog-theme">{children}</div>
	),
}));

const user = {
	userId: "USR_ADMIN",
	email: "admin@example.com",
	name: "Admin Actor",
	phone: "0900000001",
	address: null,
	roleCode: "admin",
	roleName: "Administrator",
	permissions: ["user:read", "user:update"],
	hasPassword: true,
};

const customer: AdminUser = {
	userId: "USR_customer",
	email: "customer@example.com",
	name: "Customer User",
	phone: "0900000004",
	roleCode: "customer",
	roleName: "Customer",
	status: "ACTIVE",
	lastLogin: null,
	createdAt: "2026-11-09T09:08:59.051124Z",
};

const customerDetail: AdminUserDetail = {
	...customer,
	address: "12 Nguyen Hue Street",
	permissions: [],
};

function page(
	content: AdminUser[] = [customer],
	pageNumber = 0,
	totalPages = 1,
	totalElements = content.length,
) {
	return { content, page: pageNumber, size: 20, totalElements, totalPages };
}

async function flush() {
	await act(async () => {
		await Promise.resolve();
	});
}

function customersElement() {
	return (
		<App>
			<CustomersView />
		</App>
	);
}

function renderCustomers() {
	return render(customersElement());
}

beforeEach(() => {
	nav.search = "";
	nav.replace.mockReset();
	useAuthStore.setState({ status: "authenticated", user });
	// antd's responsive pieces read these; jsdom provides neither.
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
		matches: false,
		addListener() {},
		removeListener() {},
		addEventListener() {},
		removeEventListener() {},
	}));
	vi.stubGlobal("ResizeObserver", class {
		observe() {}
		unobserve() {}
		disconnect() {}
	});
	vi.mocked(listAdminUsers).mockReset().mockResolvedValue(page());
	vi.mocked(getAdminUser).mockReset().mockResolvedValue(customerDetail);
	vi.mocked(setAdminUserStatus)
		.mockReset()
		.mockResolvedValue({ ...customerDetail, status: "LOCKED" });
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

it("customers_ignoresStaffRoleInUrl", async () => {
	nav.search = "roleCode=admin&page=1";

	renderCustomers();
	await flush();

	expect(listAdminUsers).toHaveBeenCalledWith(
		expect.objectContaining({ roleCode: "customer", page: 0 }),
		expect.any(AbortSignal),
	);
}, 15000);

it("customers_readOnlyHasNoActions", async () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["user:read"] },
	});

	const view = renderCustomers();
	await flush();

	expect(screen.queryByRole("button", { name: /lock/i })).toBeNull();
	expect(screen.queryByRole("button", { name: /unlock/i })).toBeNull();
	expect(screen.queryByRole("button", { name: /edit profile/i })).toBeNull();

	view.unmount();
	vi.mocked(listAdminUsers).mockClear();
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: [] },
	});
	renderCustomers();
	await flush();

	expect(listAdminUsers).not.toHaveBeenCalled();
	expect(screen.getByText(/user:read/i)).toBeTruthy();
});

it("lockCustomer_refreshesDirectory", async () => {
	vi.mocked(listAdminUsers)
		.mockResolvedValueOnce(page())
		.mockResolvedValue(page([{ ...customer, status: "LOCKED" }]));

	renderCustomers();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "Lock Customer User" }),
	);
	fireEvent.click(screen.getByRole("button", { name: "Lock" }));
	await flush();

	expect(setAdminUserStatus).toHaveBeenCalledWith("USR_customer", "LOCKED");
	expect(listAdminUsers).toHaveBeenCalledTimes(2);
	expect(await screen.findByText("Locked")).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "Unlock Customer User" }),
	).toBeTruthy();
});

it("lockCustomer_clampsPageWhenFilteredRowDisappears", async () => {
	nav.search = "page=2&status=ACTIVE";
	vi.mocked(listAdminUsers).mockResolvedValue(page([customer], 1, 2, 21));

	const view = renderCustomers();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "Lock Customer User" }),
	);
	fireEvent.click(screen.getByRole("button", { name: "Lock" }));
	await flush();

	expect(setAdminUserStatus).toHaveBeenCalledWith("USR_customer", "LOCKED");
	expect(nav.replace).toHaveBeenCalledWith("/admin/customers?status=ACTIVE");

	nav.search = "status=ACTIVE";
	view.rerender(customersElement());
	await flush();

	expect(listAdminUsers).toHaveBeenLastCalledWith(
		expect.objectContaining({ page: 0 }),
		expect.any(AbortSignal),
	);
});

it("customers_showsOneBasedPageWhileSendingZeroBased", async () => {
	nav.search = "page=1";

	renderCustomers();
	await flush();

	expect(listAdminUsers).toHaveBeenCalledWith(
		expect.objectContaining({ page: 0 }),
		expect.any(AbortSignal),
	);
});

it("customers_resetsPageOnFilterChange", async () => {
	nav.search = "page=3";
	vi.mocked(listAdminUsers).mockResolvedValue(page([customer], 2, 5, 100));

	const view = renderCustomers();
	await flush();

	fireEvent.mouseDown(
		screen.getByRole("combobox", { name: "Filter by status" }),
	);
	fireEvent.click(await screen.findByTitle("Active"));
	expect(nav.replace).toHaveBeenCalledWith("/admin/customers?status=ACTIVE");

	nav.search = "status=ACTIVE";
	view.rerender(customersElement());
	await flush();

	expect(listAdminUsers).toHaveBeenLastCalledWith(
		expect.objectContaining({ status: "ACTIVE", page: 0 }),
		expect.any(AbortSignal),
	);
});

it("customers_pinsNullableContactDisplay", async () => {
	vi.mocked(listAdminUsers).mockResolvedValue(
		page([{ ...customer, phone: null }]),
	);
	vi.mocked(getAdminUser).mockResolvedValue({
		...customerDetail,
		phone: null,
		address: null,
	});

	renderCustomers();
	await flush();

	const row = screen.getByText("customer@example.com").closest("tr");
	expect(row).not.toBeNull();
	expect(within(row as HTMLElement).getByText("—")).toBeTruthy();

	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	await flush();

	expect(await screen.findByText("Address")).toBeTruthy();
	// Phone and address are both null: both render as an em dash, never as
	// an empty string or the word "null".
	expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
	expect(screen.queryByText("null")).toBeNull();
});

it("customers_lockConfirmationRejectedStaysOpen", async () => {
	vi.mocked(setAdminUserStatus).mockRejectedValue(
		new ApiError("Cannot modify the last active administrator", 409),
	);

	renderCustomers();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "Lock Customer User" }),
	);
	fireEvent.click(screen.getByRole("button", { name: "Lock" }));
	await flush();

	expect(
		screen.getByText("Cannot modify the last active administrator"),
	).toBeTruthy();
	expect(screen.getByRole("dialog")).toBeTruthy();
	expect(setAdminUserStatus).toHaveBeenCalledTimes(1);
});

it("customers_detailShowsAddressOnlyWhenSelected", async () => {
	renderCustomers();
	await flush();

	expect(screen.queryByText("12 Nguyen Hue Street")).toBeNull();
	expect(getAdminUser).not.toHaveBeenCalled();

	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	await flush();

	expect(getAdminUser).toHaveBeenCalledWith(
		"USR_customer",
		expect.any(AbortSignal),
	);
	expect(await screen.findByText("12 Nguyen Hue Street")).toBeTruthy();
});

it("customers_ignoresLateDetailResultAfterSelectionChanges", async () => {
	const beta: AdminUser = {
		...customer,
		userId: "USR_beta",
		email: "beta@example.com",
		name: "Beta Customer",
	};
	vi.mocked(listAdminUsers).mockResolvedValue(page([customer, beta]));

	let resolveAlpha: (detail: AdminUserDetail) => void = () => {};
	const alphaDetail = new Promise<AdminUserDetail>((resolve) => {
		resolveAlpha = resolve;
	});
	vi.mocked(getAdminUser).mockImplementation((userId: string) =>
		userId === "USR_customer"
			? alphaDetail
			: Promise.resolve({
					...customerDetail,
					userId: "USR_beta",
					address: "Beta address",
				}),
	);

	renderCustomers();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	fireEvent.click(
		screen.getByRole("button", { name: "View details for Beta Customer" }),
	);
	await flush();

	expect(await screen.findByText("Beta address")).toBeTruthy();

	resolveAlpha({ ...customerDetail, address: "Alpha address" });
	await flush();

	expect(screen.queryByText("Alpha address")).toBeNull();
	expect(screen.getByText("Beta address")).toBeTruthy();
});
