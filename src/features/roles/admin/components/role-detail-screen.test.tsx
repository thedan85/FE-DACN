import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { getMe } from "@/features/auth/api/auth.api";
import { getRole, listPermissions, updateRole, replaceRolePermissions } from "../api/roles.api";
import { roleFixture, roleDetailFixture, permissionFixture } from "../test-fixtures";
import { signInRoleActor, stubRoleBrowser } from "../test-utils";
import { RoleDetailScreen } from "./role-detail-screen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../api/roles.api", () => ({ getRole: vi.fn(), listPermissions: vi.fn(), updateRole: vi.fn(), replaceRolePermissions: vi.fn(), deleteRole: vi.fn() }));
vi.mock("@/features/auth/api/auth.api", () => ({ getMe: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }));
const product = { ...permissionFixture, permissionId: "opaque-product-id", code: "product:update", resource: "product", name: "Update Product" };
beforeEach(() => {
	vi.clearAllMocks(); stubRoleBrowser();
	vi.mocked(getRole).mockResolvedValue(roleDetailFixture);
	vi.mocked(listPermissions).mockResolvedValue([permissionFixture, product]);
	vi.mocked(updateRole).mockImplementation(async (_, input) => ({ ...roleDetailFixture, ...input }));
	vi.mocked(replaceRolePermissions).mockResolvedValue({ ...roleDetailFixture, permissions: [permissionFixture, product] });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "anonymous" }); });
async function mount() { render(<App><RoleDetailScreen roleId={roleDetailFixture.roleId} /></App>); await screen.findByRole("heading", { level: 1, name: /Support|Administrator|Customer/ }); }

it("renders no access without any reads", () => {
	signInRoleActor(["role:update"]); render(<App><RoleDetailScreen roleId="arbitrary-id" /></App>);
	expect(screen.getByText("You don't have access to roles")).toBeTruthy();
	expect(getRole).not.toHaveBeenCalled();
	expect(listPermissions).not.toHaveBeenCalled();
});

it.each([
	["Name", "a".repeat(256), "Use at most 255 characters."],
	["Description", "a".repeat(2001), "Use at most 2000 characters."],
])("keeps over-length %s unchanged and blocks role updates", async (label, value, error) => {
	signInRoleActor(["role:read", "role:update"]); await mount();
	const input = screen.getByRole("textbox", { name: label });
	expect(input.hasAttribute("maxlength")).toBe(false);
	fireEvent.change(input, { target: { value } });
	await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false));
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	expect(await screen.findByText(error)).toBeTruthy();
	expect(input).toHaveProperty("value", value);
	expect(updateRole).not.toHaveBeenCalled();
	expect(replaceRolePermissions).not.toHaveBeenCalled();
});
it("shows a 404 for a missing role", async () => {
	signInRoleActor(["role:read"]); vi.mocked(getRole).mockRejectedValue(new ApiError("missing", 404));
	render(<App><RoleDetailScreen roleId="arbitrary-id" /></App>);
	expect(await screen.findByText("Role not found")).toBeTruthy();
});
it("is read-only without role:update", async () => {
	signInRoleActor(["role:read"]); await mount();
	expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("disabled", true);
	expect(screen.getByRole("checkbox", { name: /Update Product/ })).toHaveProperty("disabled", true);
	expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});

it("does not warn a read-only viewer about automatically checked admin grants", async () => {
	signInRoleActor(["role:read"]);
	vi.mocked(getRole).mockResolvedValue({ ...roleFixture, permissions: [] });
	await mount();
	const event = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(event);
	expect(event.defaultPrevented).toBe(false);
});

it.each([null, ""])("saves a permission-only change while leaving name=%j unchanged", async (name) => {
	signInRoleActor(["role:read", "role:update"]);
	vi.mocked(getRole).mockResolvedValue({ ...roleDetailFixture, name });
	vi.mocked(replaceRolePermissions).mockResolvedValue({ ...roleDetailFixture, name, permissions: [permissionFixture, product] });
	render(<App><RoleDetailScreen roleId={roleDetailFixture.roleId} /></App>);
	await screen.findByRole("checkbox", { name: /Update Product/ });
	fireEvent.click(screen.getByRole("checkbox", { name: /Update Product/ }));
	await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false));
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await screen.findByText("Role updated successfully");
	expect(updateRole).not.toHaveBeenCalled();
	expect(replaceRolePermissions).toHaveBeenCalledWith(roleDetailFixture.roleId, ["PERM_user-read", "opaque-product-id"]);
	await screen.findByText("No changes");
});
it("keeps all admin user/role permissions checked and disabled, but other resources editable", async () => {
	signInRoleActor(["role:read", "role:update"]);
	vi.mocked(getRole).mockResolvedValue({ ...roleFixture, permissions: [] });
	await mount();
	const locked = screen.getByRole("checkbox", { name: /Read User/ });
	expect(locked).toHaveProperty("checked", true);
	expect(locked).toHaveProperty("disabled", true);
	expect(screen.getByRole("checkbox", { name: /Update Product/ })).toHaveProperty("disabled", false);
	expect(screen.getByText("The admin role must always keep user and role permissions")).toBeTruthy();
});
it("keeps customer permissions read-only while allowing its name to change", async () => {
	signInRoleActor(["role:read", "role:update"]);
	vi.mocked(getRole).mockResolvedValue({ ...roleDetailFixture, code: "customer", name: "Customer", system: true });
	await mount();
	expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("disabled", false);
	expect(screen.getByRole("checkbox", { name: /Update Product/ })).toHaveProperty("disabled", true);
});
it("PATCHes information before PUTting the full id set", async () => {
	signInRoleActor(["role:read", "role:update"]); await mount();
	fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Support Desk" } });
	fireEvent.click(screen.getByRole("checkbox", { name: /Update Product/ }));
	await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false));
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await screen.findByText("Role updated successfully");
	expect(updateRole).toHaveBeenCalledWith(roleDetailFixture.roleId, { name: "Support Desk" });
	expect(replaceRolePermissions).toHaveBeenCalledWith(roleDetailFixture.roleId, ["PERM_user-read", "opaque-product-id"]);
	expect(vi.mocked(updateRole).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(replaceRolePermissions).mock.invocationCallOrder[0]);
});
it("keeps a failed permissions change dirty and does not PATCH saved information again", async () => {
	signInRoleActor(["role:read", "role:update"]); vi.mocked(replaceRolePermissions).mockRejectedValueOnce(new ApiError("The admin role must keep every user and role permission", 409)); await mount();
	fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Support Desk" } });
	fireEvent.click(screen.getByRole("checkbox", { name: /Update Product/ }));
	await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false));
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await screen.findByText("Role partially updated");
	expect(screen.getByRole("checkbox", { name: /Update Product/ })).toHaveProperty("checked", true);
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await screen.findByText("Role updated successfully");
	expect(updateRole).toHaveBeenCalledTimes(1);
	expect(replaceRolePermissions).toHaveBeenCalledTimes(2);
});
it("refetches a changed permission list after a permission 404", async () => {
	signInRoleActor(["role:read", "role:update"]);
	vi.mocked(listPermissions).mockResolvedValueOnce([permissionFixture, product]).mockResolvedValue([permissionFixture]);
	vi.mocked(replaceRolePermissions).mockRejectedValue(new ApiError("permission not found: opaque-product-id", 404));
	await mount(); fireEvent.click(screen.getByRole("checkbox", { name: /Update Product/ }));
	await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false));
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	expect(await screen.findByText(/The permission list changed/)).toBeTruthy();
	expect(listPermissions).toHaveBeenCalledTimes(2);
	expect(screen.queryByRole("checkbox", { name: /Update Product/ })).toBeNull();
});

it("does not reintroduce a deleted admin-locked permission after refreshing the catalog", async () => {
	signInRoleActor(["role:read", "role:update"]);
	vi.mocked(getRole).mockResolvedValue({ ...roleFixture, permissions: [permissionFixture] });
	vi.mocked(listPermissions).mockResolvedValueOnce([permissionFixture, product]).mockResolvedValue([product]);
	vi.mocked(replaceRolePermissions).mockRejectedValueOnce(new ApiError("permission not found: PERM_user-read", 404)).mockResolvedValue({ ...roleFixture, permissions: [product] });
	await mount(); fireEvent.click(screen.getByRole("checkbox", { name: /Update Product/ }));
	await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false));
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await screen.findByText(/The permission list changed/);
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await screen.findByText("Role updated successfully");
	expect(replaceRolePermissions).toHaveBeenLastCalledWith(roleFixture.roleId, ["opaque-product-id"]);
});

it("Cancel after a permission 404 cannot restore deleted ids into a later save", async () => {
	signInRoleActor(["role:read", "role:update"]);
	vi.mocked(getRole).mockResolvedValue({ ...roleFixture, permissions: [permissionFixture] });
	vi.mocked(listPermissions).mockResolvedValueOnce([permissionFixture, product]).mockResolvedValue([product]);
	vi.mocked(replaceRolePermissions).mockRejectedValueOnce(new ApiError("permission not found: PERM_user-read", 404)).mockResolvedValue({ ...roleFixture, permissions: [product] });
	await mount(); fireEvent.click(screen.getByRole("checkbox", { name: /Update Product/ }));
	await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false));
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await screen.findByText(/The permission list changed/);
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	fireEvent.click(screen.getByRole("checkbox", { name: /Update Product/ }));
	await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false));
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await screen.findByText("Role updated successfully");
	expect(replaceRolePermissions).toHaveBeenLastCalledWith(roleFixture.roleId, ["opaque-product-id"]);
});

it("refreshes own-role auth even when only the information PATCH succeeds", async () => {
	const actor = signInRoleActor(["role:read", "role:update"], "support");
	vi.mocked(getMe).mockResolvedValue(actor);
	vi.mocked(replaceRolePermissions).mockRejectedValueOnce(new ApiError("Permission set changed", 409));
	await mount();
	fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Support Desk" } });
	fireEvent.click(screen.getByRole("checkbox", { name: /Update Product/ }));
	await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false));
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	const dialog = await screen.findByRole("dialog");
	fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
	await screen.findByText("Role partially updated");
	await waitFor(() => expect(getMe).toHaveBeenCalledTimes(1));
	expect(screen.getByRole("checkbox", { name: /Update Product/ })).toHaveProperty("checked", true);
});

it("Cancel resets the live selection and changed information without any requests", async () => {
	signInRoleActor(["role:read", "role:update"]); await mount();
	fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Changed" } });
	fireEvent.click(screen.getByRole("button", { name: "Select all product permissions" }));
	await screen.findByText(/\+1 added, -0 removed/);
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	await screen.findByText("No changes");
	expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Support");
	expect(screen.getByRole("checkbox", { name: /Update Product/ })).toHaveProperty("checked", false);
	expect(updateRole).not.toHaveBeenCalled();
	expect(replaceRolePermissions).not.toHaveBeenCalled();
});

it("confirms own-permission changes before any write and refreshes auth afterwards", async () => {
	const actor = signInRoleActor(["role:read", "role:update"], "support");
	vi.mocked(getMe).mockResolvedValue({ ...actor, permissions: ["role:read"] });
	await mount(); fireEvent.click(screen.getByRole("checkbox", { name: /Update Product/ }));
	await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false));
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	const dialog = await screen.findByRole("dialog");
	expect(within(dialog).getByText("You are changing your own permissions. This takes effect on your next request.")).toBeTruthy();
	expect(replaceRolePermissions).not.toHaveBeenCalled();
	fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
	await waitFor(() => expect(getMe).toHaveBeenCalledTimes(1));
	expect(useAuthStore.getState().user?.permissions).toEqual(["role:read"]);
	expect(await screen.findByRole("textbox", { name: "Name" })).toHaveProperty("disabled", true);
});
it("redirects to the dashboard after own role:read is removed", async () => {
	const actor = signInRoleActor(["role:read", "role:update"], "support");
	vi.mocked(getMe).mockResolvedValue({ ...actor, permissions: [] });
	await mount(); fireEvent.click(screen.getByRole("checkbox", { name: /Read User/ }));
	await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false));
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	const dialog = await screen.findByRole("dialog");
	fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
	await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/dashboard"));
	expect(screen.getByText(/You no longer have access to roles/)).toBeTruthy();
});
it("does not write if the own-permission confirmation is cancelled", async () => {
	signInRoleActor(["role:read", "role:update"], "support");
	await mount(); fireEvent.click(screen.getByRole("checkbox", { name: /Update Product/ }));
	await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false));
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	const dialog = await screen.findByRole("dialog");
	fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
	expect(replaceRolePermissions).not.toHaveBeenCalled();
	expect(updateRole).not.toHaveBeenCalled();
});
