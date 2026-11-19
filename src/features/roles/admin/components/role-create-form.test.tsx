import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { createRole } from "../api/roles.api";
import { roleDetailFixture } from "../test-fixtures";
import { signInRoleActor, stubRoleBrowser } from "../test-utils";
import { RoleCreateForm } from "./role-create-form";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../api/roles.api", () => ({ createRole: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); stubRoleBrowser(); vi.mocked(createRole).mockResolvedValue({ ...roleDetailFixture, permissions: [] }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "anonymous" }); });
function mount() { render(<App><RoleCreateForm /></App>); }
function fill() {
	fireEvent.change(screen.getByRole("textbox", { name: "Code" }), { target: { value: "Support_NEW" } });
	fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Support" } });
}

it("does not create a form instance without role:create", () => {
	signInRoleActor(["role:read"]); mount();
	expect(screen.getByText("You can't add roles")).toBeTruthy();
	expect(screen.queryByRole("textbox", { name: "Code" })).toBeNull();
});
it("creates and navigates to the returned opaque id", async () => {
	signInRoleActor(["role:create"]); mount(); fill();
	fireEvent.click(screen.getByRole("button", { name: "Create role" }));
	expect(await screen.findByText("Role created. Now choose its permissions.")).toBeTruthy();
	expect(createRole).toHaveBeenCalledWith({ code: "Support_NEW", name: "Support" });
	expect(router.push).toHaveBeenCalledWith("/admin/roles/generated-role%2F42%25");
});
it("maps a 409 onto code", async () => {
	signInRoleActor(["role:create"]); vi.mocked(createRole).mockRejectedValue(new ApiError("Role code already exists", 409)); mount(); fill();
	fireEvent.click(screen.getByRole("button", { name: "Create role" }));
	expect(await screen.findByText("Role code already exists")).toBeTruthy();
	expect(router.push).not.toHaveBeenCalled();
});
it("shows field errors and unparsed 400 text in the form alert", async () => {
	signInRoleActor(["role:create"]); vi.mocked(createRole).mockRejectedValue(new ApiError("name: Already taken; A business rule changed", 400)); mount(); fill();
	fireEvent.click(screen.getByRole("button", { name: "Create role" }));
	expect(await screen.findByText("Already taken")).toBeTruthy();
	expect(screen.getByText("A business rule changed")).toBeTruthy();
});
it("blocks invalid code and an empty name before calling the API", async () => {
	signInRoleActor(["role:create"]); mount();
	fireEvent.change(screen.getByRole("textbox", { name: "Code" }), { target: { value: "x" } });
	fireEvent.click(screen.getByRole("button", { name: "Create role" }));
	expect(await screen.findByText("Enter the role name.")).toBeTruthy();
	expect(createRole).not.toHaveBeenCalled();
});

it.each(["Code", "Name", "Description"])("does not natively truncate %s", (label) => {
	signInRoleActor(["role:create"]); mount();
	expect(screen.getByRole("textbox", { name: label }).hasAttribute("maxlength")).toBe(false);
});

it.each([
	["Code", "a".repeat(51), "Code must be 2–50 characters."],
	["Name", "a".repeat(256), "Use at most 255 characters."],
	["Description", "a".repeat(2001), "Use at most 2000 characters."],
])("keeps over-length %s unchanged and blocks creation", async (label, value, error) => {
	signInRoleActor(["role:create"]); mount(); fill();
	const input = screen.getByRole("textbox", { name: label });
	fireEvent.change(input, { target: { value } });
	fireEvent.click(screen.getByRole("button", { name: "Create role" }));
	expect(await screen.findByText(error)).toBeTruthy();
	expect(input).toHaveProperty("value", value);
	expect(input.getAttribute("aria-invalid")).toBe("true");
	expect(createRole).not.toHaveBeenCalled();
});
