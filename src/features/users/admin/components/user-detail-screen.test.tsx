import { act, cleanup, render, screen } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { MeData } from "@/features/auth/types";
import { useAuthStore } from "@/stores/auth-store";

import { getAdminUser } from "../api/users.api";
import type { UserDetail } from "../schema/user.schema";
import { UserDetailScreen } from "./user-detail-screen";

const router = vi.hoisted(() => ({
	replace: vi.fn(),
	push: vi.fn(),
	refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("../api/users.api", () => ({
	getAdminUser: vi.fn(),
	deleteAdminUser: vi.fn(),
}));

const alice: UserDetail = {
	userId: "USR_alice",
	email: "alice@test.com",
	name: "Alice User",
	phone: "0900000001",
	address: "12 Reef Street",
	roleCode: "employee",
	roleName: "Employee",
	status: "ACTIVE",
	lastLogin: "2026-11-01T00:00:00.000Z",
	createdAt: "2026-10-12T00:00:00.000Z",
	permissions: ["order:read", "product:read"],
};

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
			<UserDetailScreen userId="USR_alice" />
		</App>,
	);
	await flush();
}

beforeEach(() => {
	vi.mocked(getAdminUser).mockReset().mockResolvedValue(alice);
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

it("renders the profile, role, and permissions from the detail response", async () => {
	signIn(["user:read"]);
	await mount();

	expect(getAdminUser).toHaveBeenCalledWith("USR_alice");
	expect(
		screen.getByRole("heading", { name: "Alice User", level: 1 }),
	).toBeTruthy();
	expect(screen.getByText("USR_alice")).toBeTruthy();
	expect(screen.getByText("Member since Oct 12, 2026")).toBeTruthy();
	expect(screen.getByText("Employee")).toBeTruthy();
	expect(screen.getByText("product:read")).toBeTruthy();
});

it.each([
	{ roleCode: "employee", roleName: "Employee account" },
	{ roleCode: "admin", roleName: "Admin account" },
	{ roleCode: "customer", roleName: "Customer account" },
	{ roleCode: "missing_custom", roleName: "Custom account" },
])("shows $roleName in detail without depending on an options catalog", async (role) => {
	signIn(["user:read"]);
	vi.mocked(getAdminUser).mockResolvedValue({ ...alice, ...role });
	await mount();
	expect(screen.getByText(role.roleName)).toBeTruthy();
});

it.each([null, ""])("renders name=%j as the email local part and a null phone as an em dash", async (name) => {
	signIn(["user:read"]);
	vi.mocked(getAdminUser).mockResolvedValue({ ...alice, name, phone: null });
	await mount();

	expect(screen.getByRole("heading", { name: "alice", level: 1 })).toBeTruthy();
	expect(screen.getAllByText("alice")).toHaveLength(2);
	expect(screen.getByText("—")).toBeTruthy();
});

it("renders a not-found result for a deleted or missing account", async () => {
	signIn(["user:read"]);
	vi.mocked(getAdminUser).mockRejectedValue(
		new ApiError("user not found: USR_alice", 404),
	);

	await mount();

	expect(screen.getByText("User not found")).toBeTruthy();
	expect(screen.getByText("Back to user accounts")).toBeTruthy();
});

it("renders a forbidden result when the server refuses the read", async () => {
	signIn(["user:read"]);
	vi.mocked(getAdminUser).mockRejectedValue(
		new ApiError("Access denied", 403),
	);

	await mount();

	expect(
		screen.getByText("You don't have permission to view this account"),
	).toBeTruthy();
});

it("hides edit and delete without their permissions", async () => {
	signIn(["user:read"]);
	await mount();

	expect(screen.queryByText("Edit user")).toBeNull();
	expect(screen.queryByText("Delete user")).toBeNull();
});

it("shows edit and delete with their permissions", async () => {
	signIn(["user:read", "user:update", "user:delete"]);
	await mount();

	expect(screen.getByText("Edit user")).toBeTruthy();
	expect(screen.getByText("Delete user")).toBeTruthy();
});

it("requests nothing and shows a no-access result without user:read", async () => {
	signIn(["user:update"]);
	await mount();

	expect(
		screen.getByText("You don't have access to user accounts"),
	).toBeTruthy();
	expect(getAdminUser).not.toHaveBeenCalled();
});
