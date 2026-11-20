import type { ReactNode } from "react";

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { clearSession, setAccessToken } from "@/features/auth/session";
import { useAuthStore } from "@/stores/auth-store";

import {
	getAdminUser,
	listAdminUsers,
	patchCustomerProfile,
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
	setAdminUserStatus: vi.fn(),
	patchCustomerProfile: vi.fn(),
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
	clearSession();
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
	vi.mocked(patchCustomerProfile)
		.mockReset()
		.mockResolvedValue({ ...customerDetail });
});

afterEach(() => {
	cleanup();
	clearSession();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
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

it("profileEdit_sendsOnlyChangedFields", async () => {
	vi.mocked(listAdminUsers).mockResolvedValue(
		page([{ ...customer, phone: null }]),
	);
	// A null phone and a populated address: clearing the address sends only
	// `address: null`.
	vi.mocked(getAdminUser).mockResolvedValue({
		...customerDetail,
		phone: null,
		address: "12 Nguyen Hue Street",
	});

	renderCustomers();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
	await flush();

	fireEvent.change(await screen.findByLabelText("Address"), {
		target: { value: "" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	expect(patchCustomerProfile).toHaveBeenCalledWith("USR_customer", {
		address: null,
	});
});

it("profileEdit_validatesPhoneAndKeepsFailedDraft", async () => {
	vi.spyOn(useAuthStore.getState(), "revalidate").mockResolvedValue(undefined);
	vi.mocked(patchCustomerProfile).mockRejectedValue(
		new ApiError("phone must match ^\\+?[0-9]{10,15}$", 400),
	);

	renderCustomers();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
	await flush();

	// Invalid input: the PATCH is never sent.
	fireEvent.change(await screen.findByLabelText("Phone"), {
		target: { value: "abc" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	expect(patchCustomerProfile).not.toHaveBeenCalled();

	fireEvent.change(await screen.findByLabelText("Phone"), {
		target: { value: "0901234567" },
	});
	fireEvent.change(screen.getByLabelText("Name"), {
		target: { value: "Renamed Customer" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	// The 400 rejection keeps the draft while the page stays readable.
	expect(patchCustomerProfile).toHaveBeenCalledTimes(1);
	expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
		"Renamed Customer",
	);
	expect(screen.getByText(/phone must match/)).toBeTruthy();

	// A 403 keeps the draft too.
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Missing permission: user:update", 403),
	);
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
		"Renamed Customer",
	);
});

it("profileEdit_pendingSaveBlocksDoubleSubmit", async () => {
	let resolveSave: (value: AdminUserDetail) => void = () => {};
	vi.mocked(patchCustomerProfile).mockReturnValue(
		new Promise<AdminUserDetail>((resolve) => {
			resolveSave = resolve;
		}),
	);

	renderCustomers();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
	await flush();

	fireEvent.change(await screen.findByLabelText("Name"), {
		target: { value: "Renamed Customer" },
	});
	await flush();

	const save = screen.getByRole("button", { name: "Save changes" });
	fireEvent.click(save);
	fireEvent.click(save);
	await flush();

	expect(patchCustomerProfile).toHaveBeenCalledTimes(1);

	resolveSave({ ...customerDetail, name: "Renamed Customer" });
	await flush();
});

it("profileEdit_successClosesRestoresFocusAndReloads", async () => {
	vi.mocked(listAdminUsers)
		.mockResolvedValueOnce(page())
		.mockResolvedValue(page([{ ...customer, name: "Renamed Customer" }]));
	vi.mocked(patchCustomerProfile).mockResolvedValue({
		...customerDetail,
		name: "Renamed Customer",
	});

	renderCustomers();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
	await flush();

	fireEvent.change(await screen.findByLabelText("Name"), {
		target: { value: "Renamed Customer" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	expect(patchCustomerProfile).toHaveBeenCalledWith("USR_customer", {
		name: "Renamed Customer",
	});
	// The active list query reloads after a successful save.
	expect(listAdminUsers).toHaveBeenCalledTimes(2);
	expect(screen.queryByRole("dialog")).toBeNull();
	expect(screen.getByRole("button", { name: /edit profile/i })).toBe(
		document.activeElement,
	);
});

it("profileEdit_unknownWriteOutcomeRequiresFreshRead", async () => {
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Could not reach the API: connection reset", 0),
	);

	renderCustomers();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
	await flush();

	fireEvent.change(await screen.findByLabelText("Name"), {
		target: { value: "Renamed Customer" },
	});
	await flush();

	const getCallsBefore = vi.mocked(getAdminUser).mock.calls.length;
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	// Save is blocked until the profile is re-read.
	expect(
		(
			screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement
		).disabled,
	).toBe(true);

	fireEvent.click(screen.getByRole("button", { name: /reload profile/i }));
	await flush();

	expect(vi.mocked(getAdminUser).mock.calls.length).toBeGreaterThan(
		getCallsBefore,
	);
	expect(
		(
			screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement
		).disabled,
	).toBe(false);
});

it("profileEdit_recoveryReadUnauthorizedHidesProfile", async () => {
	vi.spyOn(useAuthStore.getState(), "revalidate").mockResolvedValue(undefined);
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Could not reach the API: connection reset", 0),
	);
	vi.mocked(getAdminUser)
		// Detail panel read, then the form's fresh read: both succeed.
		.mockResolvedValueOnce(customerDetail)
		.mockResolvedValueOnce(customerDetail)
		// The recovery re-read after the unknown outcome: session gone.
		.mockRejectedValueOnce(new ApiError("Unauthorized", 401));

	renderCustomers();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
	await flush();

	fireEvent.change(await screen.findByLabelText("Name"), {
		target: { value: "Renamed Customer" },
	});
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /reload profile/i }));
	await flush();

	expect(screen.queryByLabelText("Name")).toBeNull();
	expect(
		screen.getByText("You do not have access to this customer"),
	).toBeTruthy();
});

it("profileEdit_recoveryReadForbiddenHidesProfile", async () => {
	vi.spyOn(useAuthStore.getState(), "revalidate").mockResolvedValue(undefined);
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Could not reach the API: connection reset", 0),
	);
	vi.mocked(getAdminUser)
		.mockResolvedValueOnce(customerDetail)
		.mockResolvedValueOnce(customerDetail)
		.mockRejectedValueOnce(new ApiError("Missing permission: user:read", 403));

	renderCustomers();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
	await flush();

	fireEvent.change(await screen.findByLabelText("Name"), {
		target: { value: "Renamed Customer" },
	});
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /reload profile/i }));
	await flush();

	expect(screen.queryByLabelText("Name")).toBeNull();
	expect(
		screen.getByText("You do not have access to this customer"),
	).toBeTruthy();
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

it("Escape in the lock confirmation returns focus to the row trigger", async () => {
	vi.mocked(listAdminUsers).mockResolvedValue(page([customer]));

	renderCustomers();
	await flush();

	const trigger = screen.getByRole("button", {
		name: "Lock Customer User",
	});
	trigger.focus();
	fireEvent.click(trigger);
	await flush();
	expect(screen.getByRole("dialog")).toBeTruthy();

	screen.getByRole("button", { name: /^Lock$/ }).focus();
	fireEvent.keyDown(document, { key: "Escape" });

	await waitFor(() => {
		expect(screen.queryByRole("dialog")).toBeNull();
	});
	await waitFor(() => {
		expect(document.activeElement).toBe(trigger);
	});
});

it.each(["user:read", "user:update"])(
	"closes the status dialog when only %s remains and keeps it closed on regrant",
	async (remainingPermission) => {
		vi.mocked(listAdminUsers).mockResolvedValue(page([customer]));

		renderCustomers();
		await flush();

		fireEvent.click(
			screen.getByRole("button", { name: "Lock Customer User" }),
		);
		await flush();
		expect(screen.getByRole("dialog")).toBeTruthy();

		act(() => {
			useAuthStore.setState({
				status: "authenticated",
				user: { ...user, permissions: [remainingPermission] },
			});
		});
		await flush();

		expect(screen.queryByRole("dialog")).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Lock Customer User" }),
		).toBeNull();

		act(() => {
			useAuthStore.setState({ user });
		});
		await flush();

		expect(screen.getByRole("button", { name: "Lock Customer User" })).toBeTruthy();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(setAdminUserStatus).not.toHaveBeenCalled();
		expect(patchCustomerProfile).not.toHaveBeenCalled();
	},
);

it("renders a fallback identity when a customer row has no profile name", async () => {
	vi.mocked(listAdminUsers).mockResolvedValue(
		page([{ ...customer, name: null }]),
	);

	renderCustomers();
	await flush();

	expect(
		screen.getByRole("button", { name: "View details for customer" }),
	).toBeTruthy();
	expect(screen.queryByText("null")).toBeNull();
});

it.each([false, true])(
	"ignores the closed status dialog's late success (access restored: %s)",
	async (restored) => {
		let finish!: (detail: AdminUserDetail) => void;
		vi.mocked(setAdminUserStatus).mockReturnValueOnce(new Promise((resolve) => {
			finish = resolve;
		}));
		renderCustomers();
		await flush();

		fireEvent.click(screen.getByRole("button", { name: "Lock Customer User" }));
		fireEvent.click(screen.getByRole("button", { name: "Lock" }));
		expect(setAdminUserStatus).toHaveBeenCalledTimes(1);
		act(() => {
			useAuthStore.setState({ user: { ...user, permissions: ["user:update"] } });
		});
		await flush();
		expect(screen.queryByRole("dialog")).toBeNull();

		if (restored) {
			act(() => {
				useAuthStore.setState({ user });
			});
			await flush();
			fireEvent.click(screen.getByRole("button", { name: "Lock Customer User" }));
		}

		finish({ ...customerDetail, status: "LOCKED" });
		await flush();
		expect(screen.queryByText("Customer User locked.")).toBeNull();
		expect(screen.queryByRole("dialog") !== null).toBe(restored);
	},
);

it("Escape in the profile editor returns focus to the Edit profile button", async () => {
	vi.mocked(listAdminUsers).mockResolvedValue(page([customer]));

	renderCustomers();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	await flush();

	const editProfile = screen.getByRole("button", { name: /edit profile/i });
	editProfile.focus();
	fireEvent.click(editProfile);
	await flush();
	expect(screen.getByRole("dialog")).toBeTruthy();

	(await screen.findByLabelText("Name")).focus();
	fireEvent.keyDown(document, { key: "Escape" });

	await waitFor(() => {
		expect(screen.queryByRole("dialog")).toBeNull();
	});
	await waitFor(() => {
		expect(document.activeElement).toBe(editProfile);
	});
});

async function openProfileEditor() {
	renderCustomers();
	await flush();
	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	await flush();
	fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
	await flush();
	await screen.findByLabelText("Name");
}

it("profileEdit_rebaseKeepsConcurrentPhoneAndReappliesEditedAddress", async () => {
	// The write failed with an unknown outcome; while it was in flight someone
	// else changed the phone. The recovery read must keep that fresh phone and
	// reapply only the address edit the admin actually made.
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Could not reach the API: connection reset", 0),
	);
	vi.mocked(getAdminUser)
		.mockResolvedValueOnce(customerDetail) // detail panel
		.mockResolvedValueOnce(customerDetail) // profile form
		.mockResolvedValueOnce({
			...customerDetail,
			phone: "0900999999",
			address: "12 Nguyen Hue Street",
		});

	await openProfileEditor();

	fireEvent.change(await screen.findByLabelText("Address"), {
		target: { value: "77 New Address" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /reload profile/i }));
	await flush();

	expect((screen.getByLabelText("Phone") as HTMLInputElement).value).toBe(
		"0900999999",
	);
	expect((screen.getByLabelText("Address") as HTMLInputElement).value).toBe(
		"77 New Address",
	);
	expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
		"Customer User",
	);

	const save = screen.getByRole("button", {
		name: "Save changes",
	}) as HTMLButtonElement;
	expect(save.disabled).toBe(false);
	fireEvent.click(save);
	await flush();

	// The re-save never reverts the concurrently changed phone.
	expect(patchCustomerProfile).toHaveBeenCalledTimes(2);
	expect(patchCustomerProfile).toHaveBeenLastCalledWith("USR_customer", {
		address: "77 New Address",
	});
});

it("profileEdit_paddedStoredNameIsNotReplayedByAnAddressEdit", async () => {
	const padded = { ...customerDetail, name: "  Customer User  " };
	vi.mocked(getAdminUser)
		.mockResolvedValueOnce(padded)
		.mockResolvedValueOnce(padded)
		.mockResolvedValueOnce({ ...padded, name: "  Renamed Customer  " });
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Could not reach the API: connection reset", 0),
	);

	await openProfileEditor();

	fireEvent.change(await screen.findByLabelText("Address"), {
		target: { value: "77 New Address" },
	});
	await flush();
	const save = screen.getByRole("button", {
		name: "Save changes",
	}) as HTMLButtonElement;
	expect(save.disabled).toBe(false);
	fireEvent.click(save);
	await flush();

	expect(patchCustomerProfile).toHaveBeenLastCalledWith("USR_customer", {
		address: "77 New Address",
	});

	fireEvent.click(screen.getByRole("button", { name: /reload profile/i }));
	await flush();

	expect(screen.getByLabelText("Name")).toHaveProperty("value", "  Renamed Customer  ");
	expect(patchCustomerProfile).toHaveBeenCalledTimes(1);
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();
	expect(patchCustomerProfile).toHaveBeenCalledTimes(2);
	expect(patchCustomerProfile).toHaveBeenLastCalledWith("USR_customer", {
		address: "77 New Address",
	});
});

it("profileEdit_rebaseKeepsClearedAddressWithNullPhone", async () => {
	const base: AdminUserDetail = {
		...customerDetail,
		phone: null,
		address: "12 Nguyen Hue Street",
	};
	vi.mocked(getAdminUser)
		.mockResolvedValueOnce(base)
		.mockResolvedValueOnce(base)
		.mockResolvedValueOnce(base);
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Could not reach the API: connection reset", 0),
	);

	await openProfileEditor();

	expect((screen.getByLabelText("Phone") as HTMLInputElement).value).toBe("");
	fireEvent.change(await screen.findByLabelText("Address"), {
		target: { value: "" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /reload profile/i }));
	await flush();

	// A null phone stays blank; the cleared address stays the only edit.
	expect((screen.getByLabelText("Phone") as HTMLInputElement).value).toBe("");
	expect((screen.getByLabelText("Address") as HTMLInputElement).value).toBe("");
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	expect(patchCustomerProfile).toHaveBeenLastCalledWith("USR_customer", {
		address: null,
	});
	for (const [, patch] of vi.mocked(patchCustomerProfile).mock.calls) {
		expect(patch).not.toHaveProperty("phone");
	}
});

it("profileEdit_revokedUpdateDisablesOpenControlsAndSubmit", async () => {
	await openProfileEditor();

	expect(
		(screen.getByLabelText("Name") as HTMLInputElement).disabled,
	).toBe(false);

	// The permission is revoked elsewhere while the dialog stays open. The
	// profile reads its authority live from the auth store, not from a snapshot
	// taken when the dialog opened.
	act(() => {
		useAuthStore.setState({
			status: "authenticated",
			user: { ...user, permissions: ["user:read"] },
		});
	});

	expect(
		(screen.getByLabelText("Name") as HTMLInputElement).disabled,
	).toBe(true);
	expect(
		(screen.getByLabelText("Phone") as HTMLInputElement).disabled,
	).toBe(true);
	expect(
		(screen.getByRole("button", {
			name: "Save changes",
		}) as HTMLButtonElement).disabled,
	).toBe(true);
});

it("profileEdit_recovered401ShowsManualReadRetryWithoutAutoWrite", async () => {
	setAccessToken("recovered-token");
	vi.spyOn(useAuthStore.getState(), "revalidate").mockResolvedValue(undefined);
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Could not reach the API: connection reset", 0),
	);
	vi.mocked(getAdminUser)
		.mockResolvedValueOnce(customerDetail)
		.mockResolvedValueOnce(customerDetail)
		// Recovery re-read: 401, but the token rehydrated.
		.mockRejectedValueOnce(new ApiError("Unauthorized", 401))
		.mockResolvedValueOnce(customerDetail);

	await openProfileEditor();
	fireEvent.change(await screen.findByLabelText("Name"), {
		target: { value: "Renamed Customer" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();
	fireEvent.click(screen.getByRole("button", { name: /reload profile/i }));
	await flush();

	// A recovered 401 is not a denial: the manual read retry is visible.
	expect(screen.queryByLabelText("Name")).toBeNull();
	expect(
		screen.queryByText("You do not have access to this customer"),
	).toBeNull();
	expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
	expect(nav.replace).not.toHaveBeenCalled();
	// No rejected write is replayed automatically.
	expect(patchCustomerProfile).toHaveBeenCalledTimes(1);

	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	await flush();

	expect(await screen.findByLabelText("Name")).toBeTruthy();
	expect(patchCustomerProfile).toHaveBeenCalledTimes(1);
});

it("profileEdit_hidesFieldsWhileRecoveryReadRevalidates", async () => {
	setAccessToken("recovered-token");
	let finishRevalidate: () => void = () => {};
	const pending = new Promise<void>((resolve) => {
		finishRevalidate = resolve;
	});
	vi.spyOn(useAuthStore.getState(), "revalidate").mockReturnValue(pending);
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Could not reach the API: connection reset", 0),
	);
	vi.mocked(getAdminUser)
		.mockResolvedValueOnce(customerDetail)
		.mockResolvedValueOnce(customerDetail)
		.mockRejectedValueOnce(new ApiError("Unauthorized", 401))
		.mockResolvedValueOnce(customerDetail);

	await openProfileEditor();
	fireEvent.change(await screen.findByLabelText("Address"), {
		target: { value: "77 New Address" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();
	fireEvent.click(screen.getByRole("button", { name: /reload profile/i }));
	await flush();

	// revalidate is still pending: protected fields must already be gone.
	expect(screen.queryByLabelText("Name")).toBeNull();
	expect(screen.queryByLabelText("Phone")).toBeNull();
	expect(screen.queryByLabelText("Address")).toBeNull();
	expect(screen.getByLabelText("Loading customer profile")).toBeTruthy();

	await act(async () => {
		finishRevalidate();
		await Promise.resolve();
	});

	expect(screen.queryByLabelText("Name")).toBeNull();
	expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	await flush();

	expect(await screen.findByLabelText("Name")).toBeTruthy();
	expect(patchCustomerProfile).toHaveBeenCalledTimes(1);
});

it("profileEdit_forbiddenRecoveryReadHidesFieldsWhileRevalidating", async () => {
	let finishRevalidate: () => void = () => {};
	const pending = new Promise<void>((resolve) => {
		finishRevalidate = resolve;
	});
	vi.spyOn(useAuthStore.getState(), "revalidate").mockReturnValue(pending);
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Could not reach the API: connection reset", 0),
	);
	vi.mocked(getAdminUser)
		.mockResolvedValueOnce(customerDetail)
		.mockResolvedValueOnce(customerDetail)
		.mockRejectedValueOnce(new ApiError("Missing permission: user:read", 403));

	await openProfileEditor();
	fireEvent.change(await screen.findByLabelText("Name"), {
		target: { value: "Renamed Customer" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();
	fireEvent.click(screen.getByRole("button", { name: /reload profile/i }));
	await flush();

	expect(screen.queryByLabelText("Name")).toBeNull();
	expect(screen.getByLabelText("Loading customer profile")).toBeTruthy();

	await act(async () => {
		finishRevalidate();
		await Promise.resolve();
	});

	expect(screen.queryByLabelText("Name")).toBeNull();
	expect(
		screen.getByText("You do not have access to this customer"),
	).toBeTruthy();
});

it("profileEdit_recovered401RetryRebasesFreshPhoneOntoAddressEdit", async () => {
	setAccessToken("recovered-token");
	vi.spyOn(useAuthStore.getState(), "revalidate").mockResolvedValue(undefined);
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Could not reach the API: connection reset", 0),
	);
	vi.mocked(getAdminUser)
		.mockResolvedValueOnce(customerDetail)
		.mockResolvedValueOnce(customerDetail)
		.mockRejectedValueOnce(new ApiError("Unauthorized", 401))
		.mockResolvedValueOnce({
			...customerDetail,
			phone: "0900999999",
			address: "12 Nguyen Hue Street",
		});

	await openProfileEditor();
	fireEvent.change(await screen.findByLabelText("Address"), {
		target: { value: "77 New Address" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();
	fireEvent.click(screen.getByRole("button", { name: /reload profile/i }));
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	await flush();

	expect(await screen.findByLabelText("Name")).toBeTruthy();
	expect((screen.getByLabelText("Phone") as HTMLInputElement).value).toBe(
		"0900999999",
	);
	expect((screen.getByLabelText("Address") as HTMLInputElement).value).toBe(
		"77 New Address",
	);

	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	expect(patchCustomerProfile).toHaveBeenCalledTimes(2);
	expect(patchCustomerProfile).toHaveBeenLastCalledWith("USR_customer", {
		address: "77 New Address",
	});
});

it("profileEdit_losingReadWhileUpdateRemainsBlocksAllWrites", async () => {
	await openProfileEditor();
	fireEvent.change(await screen.findByLabelText("Name"), {
		target: { value: "Renamed Customer" },
	});
	await flush();

	// The parent keeps the dialog open; only user:read is lost here.
	act(() => {
		useAuthStore.setState({
			status: "authenticated",
			user: { ...user, permissions: ["user:update"] },
		});
	});

	expect(screen.queryByLabelText("Name")).toBeNull();
	expect(
		(screen.getByRole("button", {
			name: "Save changes",
		}) as HTMLButtonElement).disabled,
	).toBe(true);
	expect(patchCustomerProfile).not.toHaveBeenCalled();
	expect(nav.replace).not.toHaveBeenCalled();
});

it("profileEdit_transientRecoveryFailureKeepsEditAcrossManualRetry", async () => {
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Could not reach the API: connection reset", 0),
	);
	vi.mocked(getAdminUser)
		.mockResolvedValueOnce(customerDetail) // detail panel
		.mockResolvedValueOnce(customerDetail) // profile form
		.mockRejectedValueOnce(new ApiError("Service unavailable", 500))
		.mockResolvedValueOnce({
			...customerDetail,
			phone: "0900999999", // concurrent change on the server
			address: "12 Nguyen Hue Street",
		});

	await openProfileEditor();
	fireEvent.change(await screen.findByLabelText("Address"), {
		target: { value: "77 New Address" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();
	fireEvent.click(screen.getByRole("button", { name: /reload profile/i }));
	await flush();

	// The 5xx recovery read is retryable, not a denial.
	expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
	expect(
		screen.queryByText("You do not have access to this customer"),
	).toBeNull();

	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	await flush();

	expect(await screen.findByLabelText("Name")).toBeTruthy();
	expect((screen.getByLabelText("Phone") as HTMLInputElement).value).toBe(
		"0900999999",
	);
	expect((screen.getByLabelText("Address") as HTMLInputElement).value).toBe(
		"77 New Address",
	);
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();
	expect(patchCustomerProfile).toHaveBeenLastCalledWith("USR_customer", {
		address: "77 New Address",
	});
});

it("profileEdit_regrantAfterReadLossStartsFresh", async () => {
	await openProfileEditor();
	fireEvent.change(await screen.findByLabelText("Name"), {
		target: { value: "Renamed Customer" },
	});
	await flush();

	act(() => {
		useAuthStore.setState({
			status: "authenticated",
			user: { ...user, permissions: [] },
		});
	});
	expect(screen.queryByLabelText("Name")).toBeNull();

	act(() => {
		useAuthStore.setState({ status: "authenticated", user });
	});

	expect(await screen.findByLabelText("Name")).toBeTruthy();
	expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
		"Customer User",
	);
	expect(patchCustomerProfile).not.toHaveBeenCalled();
});

it("profileEdit_hidesFieldsWhileWriteAuthRevalidates", async () => {
	setAccessToken("recovered-token");
	let finishRevalidate: () => void = () => {};
	const pending = new Promise<void>((resolve) => {
		finishRevalidate = resolve;
	});
	vi.spyOn(useAuthStore.getState(), "revalidate").mockReturnValue(pending);
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Unauthorized", 401),
	);

	await openProfileEditor();
	fireEvent.change(await screen.findByLabelText("Address"), {
		target: { value: "77 New Address" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	// Protected fields are hidden while the session check is in flight.
	expect(screen.queryByLabelText("Name")).toBeNull();
	expect(screen.queryByLabelText("Address")).toBeNull();
	expect(screen.getByLabelText("Checking your access")).toBeTruthy();
	expect(patchCustomerProfile).toHaveBeenCalledTimes(1);

	await act(async () => {
		finishRevalidate();
		await Promise.resolve();
	});

	// A recovered 401 restores the draft for a manual retry; no replay.
	expect(await screen.findByLabelText("Name")).toBeTruthy();
	expect((screen.getByLabelText("Address") as HTMLInputElement).value).toBe(
		"77 New Address",
	);
	expect(patchCustomerProfile).toHaveBeenCalledTimes(1);
});

it("profileEdit_writeForbiddenResolvesToReadOnlyAccess", async () => {
	let finishRevalidate: () => void = () => {};
	const pending = new Promise<void>((resolve) => {
		finishRevalidate = resolve;
	});
	vi.spyOn(useAuthStore.getState(), "revalidate").mockReturnValue(pending);
	vi.mocked(patchCustomerProfile).mockRejectedValueOnce(
		new ApiError("Missing permission: user:update", 403),
	);

	await openProfileEditor();
	fireEvent.change(await screen.findByLabelText("Address"), {
		target: { value: "77 New Address" },
	});
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await flush();

	expect(screen.queryByLabelText("Address")).toBeNull();
	expect(screen.getByLabelText("Checking your access")).toBeTruthy();

	await act(async () => {
		useAuthStore.setState({
			status: "authenticated",
			user: { ...user, permissions: ["user:read"] },
		});
		finishRevalidate();
		await Promise.resolve();
	});

	// The refreshed permission leaves read-only access, never a live write.
	expect((screen.getByLabelText("Address") as HTMLInputElement).disabled).toBe(
		true,
	);
	expect(
		(screen.getByText("Save changes").closest("button") as HTMLButtonElement)
			.disabled,
	).toBe(true);
	expect(patchCustomerProfile).toHaveBeenCalledTimes(1);
});

it("customers_listRecovered401OffersManualReadRetry", async () => {
	setAccessToken("recovered-token");
	vi.spyOn(useAuthStore.getState(), "revalidate").mockResolvedValue(undefined);
	vi.mocked(listAdminUsers)
		.mockRejectedValueOnce(new ApiError("Unauthorized", 401))
		.mockResolvedValue(page());

	renderCustomers();
	await flush();

	expect(screen.queryByText("customer@example.com")).toBeNull();
	expect(
		screen.queryByText("You do not have access to customer accounts"),
	).toBeNull();
	expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
	expect(nav.replace).not.toHaveBeenCalled();

	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	await flush();

	expect(await screen.findByText("customer@example.com")).toBeTruthy();
});

it("customers_hidesListWhileRevalidating", async () => {
	setAccessToken("recovered-token");
	let finishRevalidate: () => void = () => {};
	const pending = new Promise<void>((resolve) => {
		finishRevalidate = resolve;
	});
	vi.spyOn(useAuthStore.getState(), "revalidate").mockReturnValue(pending);
	vi.mocked(listAdminUsers)
		.mockRejectedValueOnce(new ApiError("Unauthorized", 401))
		.mockResolvedValue(page());

	renderCustomers();
	await flush();

	// Protected rows are hidden until the session check settles.
	expect(screen.queryByText("customer@example.com")).toBeNull();
	expect(screen.getByLabelText("Loading customers")).toBeTruthy();

	await act(async () => {
		finishRevalidate();
		await Promise.resolve();
	});
	expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

it("customers_detailRecovered401OffersManualReadRetry", async () => {
	setAccessToken("recovered-token");
	vi.spyOn(useAuthStore.getState(), "revalidate").mockResolvedValue(undefined);
	vi.mocked(getAdminUser)
		.mockRejectedValueOnce(new ApiError("Unauthorized", 401))
		.mockResolvedValue(customerDetail);

	renderCustomers();
	await flush();
	fireEvent.click(
		screen.getByRole("button", { name: "View details for Customer User" }),
	);
	await flush();

	expect(screen.getByText("We couldn't load the customer detail")).toBeTruthy();
	expect(
		screen.queryByText("You do not have access to this customer"),
	).toBeNull();
	expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
	expect(nav.replace).not.toHaveBeenCalled();

	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	await flush();

	expect(await screen.findByText("12 Nguyen Hue Street")).toBeTruthy();
});
