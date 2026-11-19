import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { listRoles } from "../api/roles.api";
import { roleFixture, customRoleFixture } from "../test-fixtures";
import { signInRoleActor, stubRoleBrowser } from "../test-utils";
import { RolesListing } from "./roles-listing";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../api/roles.api", () => ({ listRoles: vi.fn(), deleteRole: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); stubRoleBrowser(); vi.mocked(listRoles).mockResolvedValue([roleFixture, { ...customRoleFixture, name: null }]); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "anonymous" }); });
function mount() { render(<App><RolesListing /></App>); }

it("keeps the API order, handles null descriptions/names, and links opaque ids", async () => {
	signInRoleActor(["role:read", "role:create", "role:delete"]); mount();
	const link = await screen.findByRole("link", { name: "support" });
	expect(link.getAttribute("href")).toBe("/admin/roles/generated-role%2F42%25");
	expect(screen.getAllByText("No description")).toHaveLength(2);
	const rows = screen.getAllByRole("row");
	expect(within(rows[1]).getByText("Administrator")).toBeTruthy();
	expect(screen.getByRole("link", { name: "Add role" })).toBeTruthy();
	expect(screen.getAllByRole("link", { name: "View users" })[1].getAttribute("href")).toBe("/admin/users?roleCode=support");
	expect(screen.getByRole("button", { name: "Delete Administrator" })).toHaveProperty("disabled", true);
});

it("filters locally by name or code without refetching", async () => {
	signInRoleActor(["role:read"]); mount();
	await screen.findByText("Administrator");
	fireEvent.change(screen.getByRole("textbox", { name: "Search roles" }), { target: { value: "SUPP" } });
	expect(screen.queryByText("Administrator")).toBeNull();
	expect(screen.getByRole("link", { name: "support" })).toBeTruthy();
	expect(listRoles).toHaveBeenCalledTimes(1);
	fireEvent.change(screen.getByRole("textbox", { name: "Search roles" }), { target: { value: "missing" } });
	expect(screen.getByText("No roles found")).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
	expect(screen.getByText("Administrator")).toBeTruthy();
});

it("does not read data without role:read", () => {
	signInRoleActor(["role:create"]); mount();
	expect(screen.getByText("You don't have access to roles")).toBeTruthy();
	expect(listRoles).not.toHaveBeenCalled();
});

it("renders connection errors with a working retry", async () => {
	signInRoleActor(["role:read"]); vi.mocked(listRoles).mockRejectedValueOnce(new ApiError("offline", 0)); mount();
	expect(await screen.findByText(/We couldn't reach the server/)).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	expect(await screen.findByText("Administrator")).toBeTruthy();
});
