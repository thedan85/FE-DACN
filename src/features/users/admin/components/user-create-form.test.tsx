import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { MeData } from "@/features/auth/types";
import { useAuthStore } from "@/stores/auth-store";

import { listAdminRoles } from "../api/roles.api";
import { createAdminUser } from "../api/users.api";
import type { UserDetail } from "../schema/user.schema";
import { UserCreateForm } from "./user-create-form";

const router = vi.hoisted(() => ({
	replace: vi.fn(),
	push: vi.fn(),
	refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("../api/users.api", () => ({ createAdminUser: vi.fn() }));

vi.mock("../api/roles.api", () => ({ listAdminRoles: vi.fn() }));

const created: UserDetail = {
	userId: "USR_alice",
	email: "alice@example.com",
	name: "Alice User",
	phone: "0912345678",
	roleCode: "employee",
	roleName: "Employee",
	status: "ACTIVE",
	lastLogin: null,
	createdAt: "2026-10-12T00:00:00.000Z",
	address: null,
	permissions: ["user:read"],
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
		await Promise.resolve();
	});
}

/** `Form.useWatch` publishes on a macrotask, so a tick is needed after typing. */
async function settle() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

function fillRequiredFields() {
	fireEvent.change(screen.getByLabelText("Full name"), {
		target: { value: "  Alice User  " },
	});
	fireEvent.change(screen.getByLabelText("Email"), {
		target: { value: " alice@example.com " },
	});
	fireEvent.change(screen.getByLabelText("Phone"), {
		target: { value: "(091) 234-5678" },
	});
	fireEvent.change(screen.getByLabelText("Password"), {
		target: { value: "correct horse battery" },
	});
}

async function submit() {
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "Create user" }));
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});
}

beforeEach(() => {
	router.replace.mockReset();
	router.push.mockReset();
	vi.mocked(createAdminUser).mockReset().mockResolvedValue(created);
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

it("refuses a direct visit without user:create", async () => {
	signIn(["user:read"]);
	render(
		<App>
			<UserCreateForm />
		</App>,
	);
	await flush();

	expect(screen.getByText("You can't add users")).toBeTruthy();
	expect(screen.queryByLabelText("Full name")).toBeNull();
});

it("never touches the form instance when the form is not rendered", async () => {
	signIn(["user:read"]);
	const errors = vi.spyOn(console, "error").mockImplementation(() => {});

	render(
		<App>
			<UserCreateForm />
		</App>,
	);
	await flush();
	// `useForm` checks on a macrotask whether its form was ever mounted.
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});

	const disconnected = errors.mock.calls.filter(([first]) =>
		String(first).includes("not connected to any Form element"),
	);
	errors.mockRestore();

	expect(disconnected).toEqual([]);
});

it("submits the normalised payload and opens the new account", async () => {
	signIn(["user:create"]);
	render(
		<App>
			<UserCreateForm />
		</App>,
	);
	await flush();

	fillRequiredFields();
	await submit();

	expect(createAdminUser).toHaveBeenCalledWith({
		name: "Alice User",
		email: "alice@example.com",
		phone: "0912345678",
		address: undefined,
		roleCode: "employee",
		password: "correct horse battery",
	});
	expect(router.push).toHaveBeenCalledWith("/admin/users/USR_alice");
});

it.each([null, ""])("uses a display name in the success toast when the response name is %j", async (name) => {
	signIn(["user:create"]);
	vi.mocked(createAdminUser).mockResolvedValue({ ...created, name });
	render(
		<App>
			<UserCreateForm />
		</App>,
	);
	await flush();
	fillRequiredFields();
	await submit();

	expect(await screen.findByText("alice can now sign in with the password you set.")).toBeTruthy();
});

it("shows the password advice meter as the user types", async () => {
	signIn(["user:create"]);
	render(
		<App>
			<UserCreateForm />
		</App>,
	);
	await flush();

	fireEvent.change(screen.getByLabelText("Password"), {
		target: { value: "Abcdefghijk1!" },
	});
	await settle();

	expect(screen.getByText("Strong")).toBeTruthy();
	expect(screen.getByText("12 or more characters")).toBeTruthy();
});

it("puts a duplicate email on the email field", async () => {
	signIn(["user:create"]);
	vi.mocked(createAdminUser).mockRejectedValue(
		new ApiError("Email already exists", 409),
	);
	render(
		<App>
			<UserCreateForm />
		</App>,
	);
	await flush();

	fillRequiredFields();
	await submit();

	expect(await screen.findByText("Email already exists")).toBeTruthy();
	expect(router.push).not.toHaveBeenCalled();
});

it("shows the form-level message for a 400 it cannot attribute", async () => {
	signIn(["user:create"]);
	vi.mocked(createAdminUser).mockRejectedValue(
		new ApiError("The request was rejected", 400),
	);
	render(
		<App>
			<UserCreateForm />
		</App>,
	);
	await flush();

	fillRequiredFields();
	await submit();

	expect(
		await screen.findByText(
			"We couldn't create this user. Correct the fields below.",
		),
	).toBeTruthy();
});

it.each(["Full name", "Email", "Password", "Address"])("does not natively truncate %s", async (label) => {
	signIn(["user:create"]);
	render(<App><UserCreateForm /></App>);
	await flush();
	expect(screen.getByLabelText(label).hasAttribute("maxlength")).toBe(false);
});

it.each([
	["Full name", "a".repeat(256), "Name must be 255 characters or fewer."],
	["Email", `${"a".repeat(244)}@example.com`, "Email must be 255 characters or fewer."],
	["Address", "a".repeat(256), "Address must be 255 characters or fewer."],
	["Password", "a".repeat(73), "Password must be 8–72 bytes (about 72 characters, fewer if it has accented or non-Latin characters)."],
	["Password", "é".repeat(37), "Password must be 8–72 bytes (about 72 characters, fewer if it has accented or non-Latin characters)."],
])("keeps over-length %s unchanged and blocks creation", async (label, value, error) => {
	signIn(["user:create"]);
	render(<App><UserCreateForm /></App>);
	await flush();
	fillRequiredFields();
	const input = screen.getByLabelText(label);
	fireEvent.change(input, { target: { value } });
	await submit();

	expect(await screen.findByText(error)).toBeTruthy();
	expect(input).toHaveProperty("value", value);
	expect(input.getAttribute("aria-invalid")).toBe("true");
	expect(createAdminUser).not.toHaveBeenCalled();
});
