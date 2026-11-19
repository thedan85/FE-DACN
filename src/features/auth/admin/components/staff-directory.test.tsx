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
import { useAuthStore } from "@/stores/auth-store";

import {
	createAdminUser,
	deleteAdminUser,
	listAdminUsers,
	setAdminUserRole,
	setAdminUserStatus,
} from "../api/admin-users.api";
import { listAdminRoles } from "../api/admin-roles.api";
import type { AdminUser } from "../schema/admin-users.schema";
import { StaffDirectory } from "./staff-directory";

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
	permissions: ["user:read", "user:create", "user:update", "user:delete"],
	hasPassword: true,
};

const employee: AdminUser = {
	userId: "USR_EMP",
	email: "employee@example.com",
	name: "Employee User",
	phone: null,
	roleCode: "employee",
	roleName: "Employee",
	status: "ACTIVE",
	lastLogin: null,
	createdAt: "2026-11-09T09:08:58.991413Z",
};

const selfRow: AdminUser = {
	...employee,
	userId: "USR_ADMIN",
	email: "admin@example.com",
	name: "Admin Actor",
	roleCode: "admin",
	roleName: "Administrator",
};

function page(
	content: AdminUser[] = [employee],
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

function directoryElement() {
	return (
		<App>
			<StaffDirectory />
		</App>
	);
}

function renderDirectory() {
	return render(directoryElement());
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
	vi.mocked(createAdminUser).mockReset();
	vi.mocked(deleteAdminUser).mockReset().mockResolvedValue(undefined);
	vi.mocked(setAdminUserRole).mockReset();
	vi.mocked(setAdminUserStatus).mockReset();
	vi.mocked(listAdminRoles).mockReset().mockResolvedValue([]);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

it("staffList_loadsLiveRoleChoicesWithRoleRead", async () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["user:read", "role:read"] },
	});
	const timestamp = "2026-11-09T14:21:32.965135Z";
	vi.mocked(listAdminRoles).mockResolvedValue([
		{
			roleId: "ROLE_employee",
			code: "employee",
			name: "Employee",
			description: null,
			system: true,
			createdAt: timestamp,
			updatedAt: timestamp,
		},
		{
			roleId: "ROLE_catalog-editor",
			code: "catalog_editor",
			name: "Catalog Editor",
			description: null,
			system: false,
			createdAt: timestamp,
			updatedAt: timestamp,
		},
		{
			roleId: "ROLE_customer",
			code: "customer",
			name: "Customer",
			description: null,
			system: true,
			createdAt: timestamp,
			updatedAt: timestamp,
		},
	]);

	renderDirectory();
	await flush();

	expect(listAdminRoles).toHaveBeenCalled();

	fireEvent.mouseDown(
		screen.getByRole("combobox", { name: "Filter by role" }),
	);

	// Live choices replace the built-in list; the customer role is never offered.
	expect(await screen.findByTitle("Catalog Editor")).toBeTruthy();
	expect(screen.queryByTitle("Customer")).toBeNull();
});

it("staffDirectory_rendersInsideAdminCatalogTheme", async () => {
	renderDirectory();
	await flush();

	const theme = screen.getByTestId("admin-catalog-theme");
	expect(
		within(theme).getByRole("heading", { name: "Staff & Permissions" }),
	).toBeTruthy();
}, 15000);

it("does not request staff accounts without user:read", async () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: [] },
	});

	renderDirectory();
	await flush();

	expect(listAdminUsers).not.toHaveBeenCalled();
	expect(screen.getByText(/user:read/i)).toBeTruthy();
});

it("staffList_showsOneBasedPageWhileSendingZeroBased", async () => {
	nav.search = "page=1";

	renderDirectory();
	await flush();

	expect(listAdminUsers).toHaveBeenCalledWith(
		expect.objectContaining({ page: 0 }),
	);
});

it("staffList_resetsPageOnFilterChange", async () => {
	nav.search = "page=3";
	vi.mocked(listAdminUsers).mockResolvedValue(page([employee], 2, 5, 100));

	const view = renderDirectory();
	await flush();

	fireEvent.mouseDown(
		screen.getByRole("combobox", { name: "Filter by role" }),
	);
	fireEvent.click(await screen.findByTitle("Administrator"));
	expect(nav.replace).toHaveBeenCalledWith("/admin/staff?role=admin");

	nav.search = "role=admin";
	view.rerender(directoryElement());
	await flush();

	expect(listAdminUsers).toHaveBeenLastCalledWith(
		expect.objectContaining({ roleCode: "admin", page: 0 }),
	);
});

it("staffSearch_keepsTypedKeywordOutOfPageUrl", async () => {
	const view = renderDirectory();
	await flush();

	fireEvent.change(
		screen.getByLabelText("Search staff by email or name"),
		{ target: { value: "kim@example.com" } },
	);
	fireEvent.submit(screen.getByRole("search"));
	await flush();

	expect(listAdminUsers).toHaveBeenLastCalledWith(
		expect.objectContaining({ keyword: "kim@example.com" }),
	);

	fireEvent.mouseDown(
		screen.getByRole("combobox", { name: "Filter by role" }),
	);
	fireEvent.click(await screen.findByTitle("Administrator"));

	expect(nav.replace).toHaveBeenCalledTimes(1);
	expect(String(nav.replace.mock.calls[0][0])).not.toContain("keyword");

	nav.search = "role=admin";
	view.rerender(directoryElement());
	await flush();

	expect(listAdminUsers).toHaveBeenLastCalledWith(
		expect.objectContaining({ keyword: "kim@example.com", roleCode: "admin" }),
	);
	expect(
		nav.replace.mock.calls.some(([href]) =>
			String(href).includes("keyword"),
		),
	).toBe(false);
});

it("does not offer lock, role change or delete on your own row", async () => {
	vi.mocked(listAdminUsers).mockResolvedValue(page([selfRow, employee]));

	renderDirectory();
	await flush();

	const selfCell = screen.getByText("admin@example.com");
	const otherCell = screen.getByText("employee@example.com");
	const selfRowEl = selfCell.closest("tr");
	const otherRowEl = otherCell.closest("tr");
	expect(selfRowEl).not.toBeNull();
	expect(otherRowEl).not.toBeNull();

	const selfActions = within(selfRowEl as HTMLElement);
	expect(selfActions.queryByRole("button", { name: /lock/i })).toBeNull();
	expect(selfActions.queryByRole("button", { name: /change role/i })).toBeNull();
	expect(selfActions.queryByRole("button", { name: /delete/i })).toBeNull();

	const otherActions = within(otherRowEl as HTMLElement);
	expect(otherActions.getByRole("button", { name: /lock/i })).toBeTruthy();
	expect(otherActions.getByRole("button", { name: /change role/i })).toBeTruthy();
	expect(otherActions.getByRole("button", { name: /delete/i })).toBeTruthy();
});

it("keeps the delete dialog open when the server answers 409", async () => {
	vi.mocked(deleteAdminUser).mockRejectedValue(
		new ApiError("Cannot modify the last active administrator", 409),
	);

	renderDirectory();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "Delete Employee User" }),
	);
	fireEvent.click(screen.getByRole("button", { name: "Delete" }));
	await flush();

	expect(
		screen.getByText("Cannot modify the last active administrator"),
	).toBeTruthy();
	expect(screen.getByRole("dialog")).toBeTruthy();
});

it("staffDirectory_escapeReturnsFocusToAddStaffTrigger", async () => {
	renderDirectory();
	await flush();

	const addStaff = screen.getByRole("button", { name: "Add staff" });
	addStaff.focus();
	fireEvent.click(addStaff);
	await flush();

	expect(screen.getByRole("dialog")).toBeTruthy();

	// Move focus inside the dialog the way the browser does on open.
	screen.getByLabelText("Email").focus();
	fireEvent.keyDown(document, { key: "Escape" });

	await waitFor(() => {
		expect(screen.queryByRole("dialog")).toBeNull();
	});
	// The trigger is connected, so focus returns to it, not to <body>.
	await waitFor(() => {
		expect(document.activeElement).toBe(addStaff);
	});
});

it("staffDirectory_escapeInChangeRoleReturnsFocusToRowTrigger", async () => {
	renderDirectory();
	await flush();

	const trigger = screen.getByRole("button", {
		name: "Change role for Employee User",
	});
	trigger.focus();
	fireEvent.click(trigger);
	await flush();

	expect(screen.getByRole("dialog")).toBeTruthy();

	within(screen.getByRole("dialog"))
		.getByLabelText("Known role code")
		.focus();
	fireEvent.keyDown(document, { key: "Escape" });

	await waitFor(() => {
		expect(screen.queryByRole("dialog")).toBeNull();
	});
	await waitFor(() => {
		expect(document.activeElement).toBe(trigger);
	});
});

it("staffDirectory_escapeInStatusDialogReturnsFocusToRowTrigger", async () => {
	renderDirectory();
	await flush();

	const trigger = screen.getByRole("button", {
		name: "Lock Employee User",
	});
	trigger.focus();
	fireEvent.click(trigger);
	await flush();

	expect(screen.getByRole("dialog")).toBeTruthy();

	// Focus the dialog's own confirm control, not the trigger.
	screen.getByRole("button", { name: /^Lock$/ }).focus();
	fireEvent.keyDown(document, { key: "Escape" });

	await waitFor(() => {
		expect(screen.queryByRole("dialog")).toBeNull();
	});
	await waitFor(() => {
		expect(document.activeElement).toBe(trigger);
	});
});

it("staffDirectory_settleWhileDialogOpenKeepsAddStaffFocus", async () => {
	let resolveList!: (value: ReturnType<typeof page>) => void;
	const initialList = new Promise<ReturnType<typeof page>>((resolve) => {
		resolveList = resolve;
	});

	vi.mocked(listAdminUsers).mockReset();
	vi.mocked(listAdminUsers).mockReturnValueOnce(initialList);

	renderDirectory();
	await flush();

	// The button renders before the list lands; the operator opens the
	// dialog while the initial read is still pending.
	const addStaff = screen.getByRole("button", { name: "Add staff" });
	addStaff.focus();
	fireEvent.click(addStaff);
	await flush();
	expect(screen.getByRole("dialog")).toBeTruthy();

	// Focus sits inside the dialog, as it does in the browser.
	screen.getByLabelText("Email").focus();

	// The initial list settles while the dialog is open.
	await act(async () => {
		resolveList(page([employee]));
	});
	await flush();
	expect(screen.getByText("Employee User")).toBeTruthy();

	fireEvent.keyDown(document, { key: "Escape" });
	await waitFor(() => {
		expect(screen.queryByRole("dialog")).toBeNull();
	});
	// The trigger was never consumed by the initial read settling, so
	// focus returns to it instead of the heading.
	await waitFor(() => {
		expect(document.activeElement).toBe(addStaff);
	});
});

it("staffDirectory_deleteLastRemainingRowMovesFocusToTheHeading", async () => {
	vi.mocked(listAdminUsers).mockReset();
	vi.mocked(listAdminUsers)
		.mockResolvedValueOnce(page([employee]))
		.mockResolvedValue(page([], 0, 1, 0));

	renderDirectory();
	await flush();

	const deleteButton = screen.getByRole("button", {
		name: "Delete Employee User",
	});
	deleteButton.focus();
	fireEvent.click(deleteButton);
	await flush();
	expect(screen.getByRole("dialog")).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: "Delete" }));
	await flush();

	// The row (and its trigger) is gone; focus lands on the stable heading.
	expect(screen.queryByRole("dialog")).toBeNull();
	expect(screen.queryByText("employee@example.com")).toBeNull();
	await waitFor(() => {
		expect(document.activeElement).toBe(
			screen.getByRole("heading", { name: "Staff & Permissions" }),
		);
	});
});

it("staffDirectory_reloadKeepsFocusOnControlsTheOperatorReached", async () => {
	let resolveReload!: (value: ReturnType<typeof page>) => void;
	const reloadPromise = new Promise<ReturnType<typeof page>>((resolve) => {
		resolveReload = resolve;
	});

	vi.mocked(listAdminUsers).mockReset();
	vi.mocked(listAdminUsers)
		.mockResolvedValueOnce(page([employee]))
		.mockReturnValueOnce(reloadPromise);

	renderDirectory();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "Delete Employee User" }),
	);
	await flush();
	expect(screen.getByRole("dialog")).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: "Delete" }));
	await flush();

	// The reload is in flight; the operator lands on the search box.
	const search = screen.getByLabelText("Search staff by email or name");
	search.focus();

	// Only now does the reload resolve and the row leave the table.
	await act(async () => {
		resolveReload(page([], 0, 1, 0));
	});
	await flush();

	expect(screen.queryByText("employee@example.com")).toBeNull();
	// The reload dropped the trigger, but the operator is on another
	// control — moving focus would steal it.
	expect(document.activeElement).toBe(search);
});

it("staffDirectory_reloadErrorFallsBackToTheHeading", async () => {
	vi.mocked(listAdminUsers).mockReset();
	vi.mocked(listAdminUsers)
		.mockResolvedValueOnce(page([employee]))
		.mockRejectedValueOnce(new Error("boom"));

	renderDirectory();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "Delete Employee User" }),
	);
	await flush();
expect(screen.getByRole("dialog")).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: "Delete" }));
	await flush();
	await flush();

	// The reload failed, so the list is gone and its row trigger went
	// with it — focus falls back to the stable heading, not <body>.
	expect(screen.getByText("We couldn't load staff accounts")).toBeTruthy();
	expect(document.activeElement).toBe(
		screen.getByRole("heading", { name: "Staff & Permissions" }),
	);
});

it("staffDirectory_reopeningAddStaffStartsWithAnEmptyPassword", async () => {
	renderDirectory();
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Add staff" }));
	const password = screen.getByLabelText("Initial password");
	fireEvent.change(password, { target: { value: "sup3r-secret" } });
	expect((password as HTMLInputElement).value).toBe("sup3r-secret");

	// Cancel, then reopen: nothing of the draft survives.
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Add staff" }));
	expect(
		(screen.getByLabelText("Initial password") as HTMLInputElement).value,
	).toBe("");
});

it("staffList_returnsToPreviousPageAfterDeletingLastRow", async () => {
	nav.search = "page=2";
	vi.mocked(listAdminUsers).mockResolvedValue(page([employee], 1, 2, 21));

	const view = renderDirectory();
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "Delete Employee User" }),
	);
	fireEvent.click(screen.getByRole("button", { name: "Delete" }));
	await flush();

	expect(nav.replace).toHaveBeenCalledWith("/admin/staff");

	nav.search = "";
	view.rerender(directoryElement());
	await flush();

	expect(listAdminUsers).toHaveBeenLastCalledWith(
		expect.objectContaining({ page: 0 }),
	);
});
