import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { MeData } from "@/features/auth/types";
import { useAuthStore } from "@/stores/auth-store";

import { listAdminRoles } from "../api/roles.api";
import {
	deleteAdminUser,
	listAdminUsers,
	setAdminUserStatus,
} from "../api/users.api";
import type { UserPage, UserSummary } from "../schema/user.schema";
import { UsersListing } from "./users-listing";

const router = vi.hoisted(() => ({
	replace: vi.fn(),
	push: vi.fn(),
	refresh: vi.fn(),
	// A stable instance: `useSearchParams` returns the same object until the URL
	// changes, and a fresh one per render would re-run the fetch effect forever.
	searchParams: new URLSearchParams(),
	pathname: "/admin/users",
}));

vi.mock("next/navigation", () => ({
	useRouter: () => router,
	usePathname: () => router.pathname,
	useSearchParams: () => router.searchParams,
}));

vi.mock("../api/users.api", () => ({
	// The component only reaches these two; the rest of the module is unused.
	ADMIN_USER_SORT_FIELDS: [
		"email",
		"name",
		"roleCode",
		"status",
		"lastLogin",
		"createdAt",
	],
	listAdminUsers: vi.fn(),
	deleteAdminUser: vi.fn(),
	setAdminUserStatus: vi.fn(),
}));

vi.mock("../api/roles.api", () => ({ listAdminRoles: vi.fn() }));

const alice: UserSummary = {
	userId: "USR_alice",
	email: "alice@test.com",
	name: "Alice User",
	phone: "0900000001",
	roleCode: "employee",
	roleName: "Employee",
	status: "ACTIVE",
	lastLogin: null,
	createdAt: "2026-10-12T00:00:00.000Z",
};

const bob: UserSummary = {
	userId: "USR_bob",
	email: "bob@test.com",
	name: "Bob Locked",
	phone: null,
	roleCode: "admin",
	roleName: "Administrator",
	status: "LOCKED",
	lastLogin: null,
	createdAt: "2026-10-13T00:00:00.000Z",
};

function page(): UserPage {
	return {
		content: [alice, bob],
		page: 0,
		size: 20,
		totalElements: 2,
		totalPages: 1,
	};
}

function signIn(permissions: string[]) {
	const user: MeData = {
		userId: "USR_admin",
		email: "admin@test.com",
		name: "Admin Actor",
		phone: null,
		address: null,
		roleCode: "admin",
		roleName: "Administrator",
		permissions,
		hasPassword: true,
	};

	useAuthStore.setState({ user, status: "authenticated" });
}

async function flush() {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

async function mount() {
	render(
		<App>
			<UsersListing />
		</App>,
	);
	await flush();
}

beforeEach(() => {
	router.replace.mockReset();
	router.pathname = "/admin/users";
	router.searchParams = new URLSearchParams();
	vi.mocked(listAdminUsers).mockReset().mockResolvedValue(page());
	vi.mocked(deleteAdminUser).mockReset().mockResolvedValue();
	vi.mocked(setAdminUserStatus)
		.mockReset()
		.mockResolvedValue({ ...alice, status: "LOCKED", address: null, permissions: [] });
	vi.mocked(listAdminRoles)
		.mockReset()
		.mockResolvedValue([
			{
				roleId: "ROL_employee",
				code: "employee",
				name: "Employee",
				description: null,
				system: true,
			},
			{
				roleId: "ROL_admin",
				code: "admin",
				name: "Administrator",
				description: null,
				system: true,
			},
		]);
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
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
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	useAuthStore.setState({ user: null, status: "loading" });
});

it("renders the first page of users with the API's zero-based page", async () => {
	signIn(["user:read"]);
	await mount();

	expect(listAdminUsers).toHaveBeenCalledWith({
		keyword: undefined,
		roleCode: undefined,
		status: undefined,
		sort: "createdAt,desc",
		page: 0,
		size: 20,
	});
	expect(screen.getByText("Alice User")).toBeTruthy();
	expect(screen.getByText("bob@test.com")).toBeTruthy();
	expect(screen.getByText(/Showing 1–2 of 2 users/)).toBeTruthy();
});

it("renders null and empty names using email fallbacks, including action labels", async () => {
	signIn(["user:read", "user:update", "user:delete"]);
	vi.mocked(listAdminUsers).mockResolvedValue({
		...page(),
		content: [{ ...alice, name: null }, { ...bob, name: "" }],
	});

	await mount();

	expect(screen.getByRole("link", { name: "alice" })).toHaveProperty("href", expect.stringContaining("/admin/users/USR_alice"));
	expect(screen.getByRole("link", { name: "bob" })).toBeTruthy();
	expect(screen.getByRole("link", { name: "View alice" })).toBeTruthy();
	expect(screen.getByRole("link", { name: "Edit bob" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "Delete alice" })).toBeTruthy();
});

it("uses the fallback in the delete dialog and its success toast", async () => {
	signIn(["user:read", "user:delete"]);
	vi.mocked(listAdminUsers).mockResolvedValue({
		...page(),
		content: [{ ...alice, name: "" }, bob],
	});
	await mount();

	fireEvent.click(screen.getByRole("button", { name: "Delete alice" }));
	const dialog = await screen.findByRole("dialog");
	expect(within(dialog).getByText("alice")).toBeTruthy();
	fireEvent.click(within(dialog).getByRole("button", { name: "Delete user" }));

	expect(await screen.findByText("alice can no longer sign in.")).toBeTruthy();
});

it("hides the add control without user:create", async () => {
	signIn(["user:read"]);
	await mount();

	expect(screen.queryByText("Add user")).toBeNull();
});

it("shows the add control with user:create", async () => {
	signIn(["user:read", "user:create"]);
	await mount();

	expect(screen.getByText("Add user")).toBeTruthy();
});

it("shows a no-access result and requests nothing without user:read", async () => {
	signIn(["user:create"]);
	await mount();

	expect(
		screen.getByText("You don't have access to user accounts"),
	).toBeTruthy();
	expect(listAdminUsers).not.toHaveBeenCalled();
});

it("shows the server's message when the list request fails", async () => {
	signIn(["user:read"]);
	vi.mocked(listAdminUsers).mockRejectedValue(
		new ApiError("The user list is unavailable", 500),
	);

	await mount();

	expect(screen.getByText("We couldn't load user accounts")).toBeTruthy();
	expect(screen.getByText("The user list is unavailable")).toBeTruthy();
	expect(screen.getByText("Try again")).toBeTruthy();
});

it("ends the session and redirects on a 401", async () => {
	signIn(["user:read"]);
	vi.mocked(listAdminUsers).mockRejectedValue(
		new ApiError("Unauthorized", 401),
	);

	await mount();

	expect(router.replace).toHaveBeenCalledWith("/admin/login");
	expect(screen.getAllByText("Your session has ended").length).toBeGreaterThan(0);
});

it("shows the empty state when the query matches nothing", async () => {
	signIn(["user:read"]);
	vi.mocked(listAdminUsers).mockResolvedValue({
		content: [],
		page: 0,
		size: 20,
		totalElements: 0,
		totalPages: 0,
	});

	await mount();

	expect(screen.getByText("No users found")).toBeTruthy();
});

function rowCheckbox(name: string): HTMLInputElement {
	const row = screen.getByText(name).closest("tr");

	if (row === null) {
		throw new Error(`No table row found for ${name}`);
	}

	return within(row).getByRole("checkbox") as HTMLInputElement;
}

it("locks the rows selected on the current page", async () => {
	signIn(["user:read", "user:update"]);
	await mount();

	fireEvent.click(rowCheckbox("Alice User"));
	expect(screen.getByText("1 selected")).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: "Lock users" }));
	await flush();

	expect(setAdminUserStatus).toHaveBeenCalledWith("USR_alice", "LOCKED");
	expect(screen.getByText("Users locked")).toBeTruthy();
});

it("names a bulk lock failure using the email fallback", async () => {
	signIn(["user:read", "user:update"]);
	vi.mocked(listAdminUsers).mockResolvedValue({
		...page(),
		content: [{ ...alice, name: "" }, bob],
	});
	vi.mocked(setAdminUserStatus).mockRejectedValue(new ApiError("Cannot lock this user", 409));
	await mount();

	fireEvent.click(rowCheckbox("alice@test.com"));
	fireEvent.click(screen.getByRole("button", { name: "Lock users" }));

	const failure = await screen.findByText(/Cannot lock this user/, undefined, {
		// Load flake on a busy suite: the 409 text renders past the 1s default.
		timeout: 15000,
	});
	expect(failure.textContent).toBe("alice: Cannot lock this user");
});

it("names a bulk delete failure using the email fallback", async () => {
	signIn(["user:read", "user:delete"]);
	vi.mocked(listAdminUsers).mockResolvedValue({
		...page(),
		content: [alice, { ...bob, name: "" }],
	});
	vi.mocked(deleteAdminUser).mockRejectedValue(new ApiError("Cannot delete this user", 409));
	await mount();

	fireEvent.click(rowCheckbox("bob@test.com"));
	fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
	const dialog = await screen.findByRole("dialog");
	fireEvent.click(within(dialog).getByRole("button", { name: "Delete user" }));

	const failure = await screen.findByText(/Cannot delete this user/);
	expect(failure.textContent).toBe("bob: Cannot delete this user");
});

it("summarises per-user failures after a bulk delete", async () => {
	signIn(["user:read", "user:delete"]);
	vi.mocked(deleteAdminUser).mockImplementation((userId) =>
		userId === bob.userId
			? Promise.reject(
					new ApiError("The last administrator can't be deleted", 409),
				)
			: Promise.resolve(),
	);

	await mount();

	fireEvent.click(rowCheckbox("Alice User"));
	fireEvent.click(rowCheckbox("Bob Locked"));
	fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));

	expect(await screen.findByText("Delete 2 users?")).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Delete users" }));

	expect(await screen.findByText("Some users weren't deleted")).toBeTruthy();
	expect(
		screen.getByText(/The last administrator can't be deleted/),
	).toBeTruthy();
	expect(deleteAdminUser).toHaveBeenCalledTimes(2);
});

it("disables the checkbox for the signed-in account", async () => {
	signIn(["user:read", "user:update"]);
	const admin: UserSummary = {
		userId: "USR_admin",
		email: "admin@test.com",
		name: "Admin Actor",
		phone: null,
		roleCode: "admin",
		roleName: "Administrator",
		status: "ACTIVE",
		lastLogin: null,
		createdAt: "2026-10-01T00:00:00.000Z",
	};

	vi.mocked(listAdminUsers).mockResolvedValue({
		content: [alice, admin],
		page: 0,
		size: 20,
		totalElements: 2,
		totalPages: 1,
	});

	await mount();

	expect(rowCheckbox("Admin Actor").disabled).toBe(true);
	expect(rowCheckbox("Alice User").disabled).toBe(false);
});

const carol: UserSummary = {
	userId: "USR_carol",
	email: "carol@test.com",
	name: "Carol Customer",
	phone: null,
	roleCode: "customer",
	roleName: "Customer",
	status: "ACTIVE",
	lastLogin: null,
	createdAt: "2026-10-15T00:00:00.000Z",
};

async function mountStaff() {
	router.pathname = "/admin/staff";
	render(
		<App>
			<UsersListing staff />
		</App>,
	);
	await flush();
}

it("staff mode renders the staff heading and links rows to the canonical user detail", async () => {
	signIn(["user:read"]);
	await mountStaff();

	expect(screen.getByRole("heading", { level: 1, name: "Staff & Permissions" }))
		.toBeTruthy();
	expect(screen.getByRole("link", { name: "Alice User" }).getAttribute("href"))
		.toBe("/admin/users/USR_alice");
	expect(screen.getByRole("link", { name: "View Alice User" }).getAttribute("href"))
		.toBe("/admin/users/USR_alice");
});

it("staff mode defaults the role filter to employee and never sends customer", async () => {
	signIn(["user:read"]);
	await mountStaff();

	expect(listAdminUsers).toHaveBeenCalledWith(
		expect.objectContaining({ roleCode: "employee" }),
	);
});

it("staff mode rejects a customer role smuggled into the URL", async () => {
	signIn(["user:read"]);
	router.pathname = "/admin/staff";
	router.searchParams = new URLSearchParams("role=CUSTOMER");
	render(
		<App>
			<UsersListing staff />
		</App>,
	);
	await flush();

	expect(listAdminUsers).toHaveBeenCalledWith(
		expect.objectContaining({ roleCode: "employee" }),
	);
});

it("staff mode suppresses every mutation when a customer row arrives", async () => {
	signIn(["user:read", "user:create", "user:update", "user:delete"]);
	vi.mocked(listAdminUsers).mockResolvedValue({
		...page(),
		content: [alice, carol],
		totalElements: 2,
	});
	await mountStaff();

	// No selection, no row actions, no create.
	expect(screen.queryByRole("checkbox")).toBeNull();
	expect(screen.queryByRole("link", { name: "Edit Alice User" })).toBeNull();
	expect(screen.queryByRole("button", { name: "Delete Alice User" })).toBeNull();
	expect(screen.queryByRole("link", { name: "Add staff" })).toBeNull();

	// The anomaly is visible, and read access is not taken away.
	expect(screen.getByText(/staff actions are disabled/i)).toBeTruthy();
	expect(screen.getByRole("link", { name: "Alice User" })).toBeTruthy();
	expect(screen.getByRole("link", { name: "View Alice User" })).toBeTruthy();
});

it("staff mode gives customer rows no canonical detail links or actions", async () => {
	signIn(["user:read", "user:create", "user:update", "user:delete"]);
	vi.mocked(listAdminUsers).mockResolvedValue({
		...page(),
		content: [alice, carol],
		totalElements: 2,
	});
	await mountStaff();

	// A customer row on the staff screen must not lead to the canonical user
	// detail, whose screen offers Delete.
	const carolRow = screen.getByText("Carol Customer").closest("tr");
	expect(carolRow).not.toBeNull();
	expect(within(carolRow as HTMLElement).queryByRole("link")).toBeNull();
	expect(within(carolRow as HTMLElement).queryByRole("button")).toBeNull();

	// Staff rows keep their read links.
	expect(screen.getByRole("link", { name: "Alice User" })).toBeTruthy();
	expect(screen.getByRole("link", { name: "View Alice User" })).toBeTruthy();
});

it("general listing keeps customer row links unchanged", async () => {
	signIn(["user:read", "user:update", "user:delete"]);
	vi.mocked(listAdminUsers).mockResolvedValue({
		...page(),
		content: [carol],
		totalElements: 1,
	});
	router.pathname = "/admin/users";
	render(
		<App>
			<UsersListing />
		</App>,
	);
	await flush();

	expect(screen.getByRole("link", { name: "Carol Customer" }).getAttribute("href"))
		.toBe("/admin/users/USR_carol");
	expect(screen.getByRole("link", { name: "View Carol Customer" })).toBeTruthy();
});

it("staff mode keeps staff mutations when no customer row arrives", async () => {
	signIn(["user:read", "user:create", "user:update", "user:delete"]);
	await mountStaff();

	expect(screen.getByRole("link", { name: "Edit Alice User" })).toBeTruthy();
	expect(screen.getByRole("link", { name: "Add staff" })).toBeTruthy();
	expect(screen.queryByText(/staff actions are disabled/i)).toBeNull();
});

it("staff mode clearing the filters stays on the compat route", async () => {
	signIn(["user:read"]);
	router.pathname = "/admin/staff";
	router.searchParams = new URLSearchParams("status=LOCKED");
	vi.mocked(listAdminUsers).mockResolvedValue({
		content: [],
		page: 0,
		size: 20,
		totalElements: 0,
		totalPages: 0,
	});
	render(
		<App>
			<UsersListing staff />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
	expect(router.replace).toHaveBeenCalledWith("/admin/staff");
});

function submitSearch(value: string) {
	const input = screen.getByLabelText("Search users by name or email");
	fireEvent.change(input, { target: { value } });
	fireEvent.submit(input.closest("form") as HTMLFormElement);
}

function replacedUrls(): string[] {
	return router.replace.mock.calls.map(([url]) => String(url));
}

it("staff mode ignores a keyword smuggled into the URL", async () => {
	signIn(["user:read"]);
	router.pathname = "/admin/staff";
	router.searchParams = new URLSearchParams("keyword=alice%40test.com");
	render(
		<App>
			<UsersListing staff />
		</App>,
	);
	await flush();

	expect(listAdminUsers).toHaveBeenCalledWith(
		expect.objectContaining({ keyword: undefined, roleCode: "employee" }),
	);
});

it("staff mode keeps its keyword local: sent to the API, never written to the URL", async () => {
	signIn(["user:read"]);
	await mountStaff();

	submitSearch("alice@test.com");
	await flush();

	expect(listAdminUsers).toHaveBeenCalledWith(
		expect.objectContaining({ keyword: "alice@test.com", roleCode: "employee" }),
	);
	expect(replacedUrls().some((url) => url.includes("keyword"))).toBe(false);
});

it("staff mode resets the page on a filter without leaking the keyword into the URL", async () => {
	signIn(["user:read"]);
	await mountStaff();

	submitSearch("alice@test.com");
	await flush();
	fireEvent.click(screen.getByRole("tab", { name: "Locked" }));
	await flush();

	// The tab carries status, resets page to 1 (omitted), and keeps the local
	// keyword out of the URL even though it is still in the API request.
	expect(router.replace).toHaveBeenCalledWith("/admin/staff?status=LOCKED");
	expect(listAdminUsers).toHaveBeenCalledWith(
		expect.objectContaining({ keyword: "alice@test.com", roleCode: "employee" }),
	);
});

it("general listing still writes its keyword to the URL", async () => {
	signIn(["user:read"]);
	await mount();

	submitSearch("alice@test.com");
	await flush();

	expect(replacedUrls().some((url) => url.includes("keyword=alice%40test.com"))).toBe(
		true,
	);
});

it("staff mode redirects a role-only account to /admin/roles without requesting users", async () => {
	signIn(["role:read"]);
	await mountStaff();

	expect(router.replace).toHaveBeenCalledWith("/admin/roles");
	expect(listAdminUsers).not.toHaveBeenCalled();
});

it("staff mode offers a known role code when role:read is missing", async () => {
	signIn(["user:read"]);
	router.pathname = "/admin/staff";
	const view = <App><UsersListing staff /></App>;
	const { rerender } = render(view);
	await flush();

	expect(screen.getByText(/showing the built-in staff roles/i)).toBeTruthy();
	for (const [input, expectedRoleCode] of [[" Support ", "support"], [" Customer ", "employee"]]) {
		fireEvent.change(screen.getByRole("textbox", { name: "Known role code" }), {
			target: { value: input },
		});
		fireEvent.click(screen.getByRole("button", { name: "Apply" }));

		const url = new URL(String(router.replace.mock.lastCall?.[0]), "http://localhost");
		router.searchParams = url.searchParams;
		rerender(<App><UsersListing staff /></App>);
		await flush();

		expect(listAdminUsers).toHaveBeenLastCalledWith(
			expect.objectContaining({ roleCode: expectedRoleCode }),
		);
	}
});

it.each(["staff@example.test", "a".repeat(51)])(
	"keeps invalid known role codes out of the Staff URL: %s",
	async (value) => {
		signIn(["user:read"]);
		await mountStaff();
		router.replace.mockClear();
		const field = screen.getByRole("textbox", { name: "Known role code" });

		fireEvent.change(field, { target: { value } });
		fireEvent.click(screen.getByRole("button", { name: "Apply" }));
		await flush();

		expect(router.replace).not.toHaveBeenCalled();
		expect(field).toHaveProperty("value", value);
		expect(field.hasAttribute("maxlength")).toBe(false);
		expect(screen.getByRole("alert").textContent).toMatch(/letters|characters/);
	},
);

it("staff mode requests nothing when neither read permission is held", async () => {
	signIn([]);
	await mountStaff();

	expect(listAdminUsers).not.toHaveBeenCalled();
	expect(listAdminRoles).not.toHaveBeenCalled();
	expect(router.replace).not.toHaveBeenCalledWith("/admin/roles");
});
