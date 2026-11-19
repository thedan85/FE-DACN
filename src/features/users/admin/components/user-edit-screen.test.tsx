import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { MeData } from "@/features/auth/types";
import { useAuthStore } from "@/stores/auth-store";

import { listAdminRoles } from "../api/roles.api";
import {
	getAdminUser,
	setAdminUserRole,
	setAdminUserStatus,
} from "../api/users.api";
import type { UserDetail } from "../schema/user.schema";
import { UserEditScreen } from "./user-edit-screen";

const router = vi.hoisted(() => ({
	replace: vi.fn(),
	push: vi.fn(),
	refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("../api/users.api", () => ({
	getAdminUser: vi.fn(),
	setAdminUserRole: vi.fn(),
	setAdminUserStatus: vi.fn(),
}));

vi.mock("../api/roles.api", () => ({ listAdminRoles: vi.fn() }));

const alice: UserDetail = {
	userId: "USR_alice",
	email: "alice@example.com",
	name: "Alice User",
	phone: "0900000001",
	roleCode: "employee",
	roleName: "Employee",
	status: "ACTIVE",
	lastLogin: null,
	createdAt: "2026-10-12T00:00:00.000Z",
	address: "12 Example Street",
	permissions: ["user:read"],
};

const aliceAsAdmin: UserDetail = {
	...alice,
	roleCode: "admin",
	roleName: "Administrator",
};

const aliceLocked: UserDetail = { ...alice, status: "LOCKED" };

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
		await Promise.resolve();
	});
}

/** `Form.useWatch` publishes on a macrotask, so a tick is needed after an edit. */
async function settle() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

async function mount() {
	render(
		<App>
			<UserEditScreen userId="USR_alice" />
		</App>,
	);
	await flush();
}

async function save() {
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});
}

beforeEach(() => {
	router.replace.mockReset();
	router.push.mockReset();
	vi.mocked(getAdminUser).mockReset().mockResolvedValue(alice);
	vi.mocked(setAdminUserRole)
		.mockReset()
		.mockResolvedValue(aliceAsAdmin);
	vi.mocked(setAdminUserStatus)
		.mockReset()
		.mockResolvedValue(aliceLocked);
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

it("refuses a direct visit without user:update", async () => {
	signIn(["user:read"]);
	await mount();

	expect(screen.getByText("You can't edit users")).toBeTruthy();
	expect(getAdminUser).not.toHaveBeenCalled();
});

it("refuses an update-only actor before fetching the account", async () => {
	signIn(["user:update"]);
	await mount();
	expect(screen.getByText("You can't edit users")).toBeTruthy();
	expect(screen.getByText(/user:read and user:update/)).toBeTruthy();
	expect(getAdminUser).not.toHaveBeenCalled();
	expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});

it("hides a previously loaded form when user:read is revoked", async () => {
	signIn(["user:read", "user:update"]);
	await mount();
	expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
	await act(async () => { signIn(["user:update"]); });
	expect(screen.getByText("You can't edit users")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});

it("renders a not-found result when the account is gone", async () => {
	signIn(["user:read", "user:update"]);
	vi.mocked(getAdminUser).mockRejectedValue(new ApiError("User not found", 404));

	await mount();

	expect(screen.getByText("User not found")).toBeTruthy();
});

it.each([null, ""])("renders name=%j in the subtitle and read-only profile with the fallback", async (name) => {
	signIn(["user:read", "user:update"]);
	vi.mocked(getAdminUser).mockResolvedValue({ ...alice, name, phone: null });
	await mount();

	expect(screen.getByText("alice · alice@example.com")).toBeTruthy();
	expect(screen.getByText("alice")).toBeTruthy();
	expect(screen.getByText("—")).toBeTruthy();
});

it("seeds the form without touching it before it is mounted", async () => {
	signIn(["user:read", "user:update"]);
	const errors = vi.spyOn(console, "error").mockImplementation(() => {});

	await mount();
	await settle();

	const disconnected = errors.mock.calls.filter(([first]) =>
		String(first).includes("not connected to any Form element"),
	);
	errors.mockRestore();

	expect(disconnected).toEqual([]);
	// The seeded control shows the account's saved role, not a blank select.
	expect(screen.getByText("Employee")).toBeTruthy();
	expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty(
		"disabled",
		true,
	);
});

const currentRoles = [
	{ roleCode: "employee", roleName: "Employee" },
	{ roleCode: "admin", roleName: "Administrator" },
	{ roleCode: "customer", roleName: "Customer account" },
	{ roleCode: "audit_team", roleName: "Audit team" },
];

it.each(currentRoles.flatMap((role) => [false, true].map((fallback) => ({ ...role, fallback }))))(
	"shows the current $roleCode role in StrictMode with fallback=$fallback",
	async ({ roleCode, roleName, fallback }) => {
		signIn(["user:read", "user:update", "role:read"]);
		vi.mocked(getAdminUser).mockResolvedValue({ ...alice, roleCode, roleName });
		if (fallback) vi.mocked(listAdminRoles).mockRejectedValue(new ApiError("No role:read", 403));
		render(<StrictMode><App><UserEditScreen userId={alice.userId} /></App></StrictMode>);
		await flush();
		await settle();

		// Assert the closed control's rendered value, not a dropdown option/title.
		const select = screen.getByRole("combobox");
		expect(select.closest(".ant-select")?.textContent).toContain(roleName);
		expect(select).toHaveProperty("disabled", fallback || roleCode === "customer");
	},
);

it.each(["ACTIVE", "LOCKED"] as const)("preserves Status=%s through StrictMode effect replay", async (status) => {
	signIn(["user:read", "user:update"]);
	vi.mocked(getAdminUser).mockResolvedValue({ ...alice, status });
	render(<StrictMode><App><UserEditScreen userId={alice.userId} /></App></StrictMode>);
	await flush();
	await settle();

	expect(screen.getByRole("radio", { name: "Locked" })).toHaveProperty("checked", status === "LOCKED");
	expect(screen.getByRole("radio", { name: "Active" })).toHaveProperty("checked", status === "ACTIVE");
});

it("shows the account's roleName rather than a different role-list label", async () => {
	signIn(["user:read", "user:update"]);
	vi.mocked(getAdminUser).mockResolvedValue({ ...alice, roleName: "Employee from account" });
	await mount();

	expect(screen.getByRole("combobox").closest(".ant-select")?.textContent).toContain("Employee from account");
});

it("keeps role and status locked but visible when editing the signed-in account", async () => {
	signIn(["user:read", "user:update"]);
	vi.mocked(getAdminUser).mockResolvedValue({ ...aliceAsAdmin, userId: "USR_admin", status: "LOCKED" });
	render(<StrictMode><App><UserEditScreen userId="USR_admin" /></App></StrictMode>);
	await flush();
	await settle();

	expect(screen.getByRole("combobox").closest(".ant-select")?.textContent).toContain("Administrator");
	expect(screen.getByRole("combobox")).toHaveProperty("disabled", true);
	expect(screen.getByRole("radio", { name: "Locked" })).toHaveProperty("checked", true);
	expect(screen.getByRole("radio", { name: "Locked" })).toHaveProperty("disabled", true);
});

it("creates a fresh form store when navigating to a different account", async () => {
	signIn(["user:read", "user:update"]);
	const view = render(<App><UserEditScreen userId={alice.userId} /></App>);
	await flush();
	vi.mocked(getAdminUser).mockResolvedValue({ ...aliceAsAdmin, userId: "another-user", status: "LOCKED" });
	view.rerender(<App><UserEditScreen userId="another-user" /></App>);
	await flush();
	await settle();

	expect(screen.getByRole("combobox").closest(".ant-select")?.textContent).toContain("Administrator");
	expect(screen.getByRole("radio", { name: "Locked" })).toHaveProperty("checked", true);
});

it("renders the profile read-only and saves only the changed status", async () => {
	signIn(["user:read", "user:update"]);
	await mount();

	expect(screen.getByText("12 Example Street")).toBeTruthy();
	expect(
		screen.getByText("Password changes are managed by the user."),
	).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "Save changes" }),
	).toHaveProperty("disabled", true);

	fireEvent.click(screen.getByRole("radio", { name: "Locked" }));
	await settle();
	expect(screen.getByText("Unsaved changes")).toBeTruthy();

	await save();

	expect(setAdminUserRole).not.toHaveBeenCalled();
	expect(setAdminUserStatus).toHaveBeenCalledWith("USR_alice", "LOCKED");
	expect(screen.getByText("User updated successfully")).toBeTruthy();
	expect(router.push).toHaveBeenCalledWith("/admin/users/USR_alice");
});

it("saves a changed role before a changed status", async () => {
	signIn(["user:read", "user:update", "role:read"]);
	await mount();

	fireEvent.mouseDown(screen.getByRole("combobox"));
	const option = await screen.findByTitle("Administrator");
	fireEvent.click(option);
	fireEvent.click(screen.getByRole("radio", { name: "Locked" }));
	await settle();

	await save();

	expect(setAdminUserRole).toHaveBeenCalledWith("USR_alice", "admin");
	expect(setAdminUserStatus).toHaveBeenCalledWith("USR_alice", "LOCKED");
	expect(
		vi.mocked(setAdminUserRole).mock.invocationCallOrder[0],
	).toBeLessThan(vi.mocked(setAdminUserStatus).mock.invocationCallOrder[0]);
});

it("reports what saved when the second update fails", async () => {
	signIn(["user:read", "user:update", "role:read"]);
	vi.mocked(setAdminUserStatus).mockRejectedValue(
		new ApiError("Invalid role; only employee and admin are supported", 409),
	);
	await mount();

	fireEvent.mouseDown(screen.getByRole("combobox"));
	const option = await screen.findByTitle("Administrator");
	fireEvent.click(option);
	fireEvent.click(screen.getByRole("radio", { name: "Locked" }));
	await settle();

	await save();

	expect(screen.getByText("User partially updated")).toBeTruthy();
	expect(
		screen.getByText(/The selected role is not available/, { exact: false }),
	).toBeTruthy();
	expect(router.push).not.toHaveBeenCalled();
});
