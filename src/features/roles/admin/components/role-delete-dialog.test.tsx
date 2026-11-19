import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { deleteRole } from "../api/roles.api";
import { customRoleFixture, roleFixture } from "../test-fixtures";
import { signInRoleActor, stubRoleBrowser } from "../test-utils";
import { RoleDeleteDialog } from "./role-delete-dialog";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../api/roles.api", () => ({ deleteRole: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); stubRoleBrowser(); signInRoleActor(["role:read", "role:delete"]); vi.mocked(deleteRole).mockResolvedValue(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "anonymous" }); });

it("deletes a custom role using the returned id after explaining soft deletion", async () => {
	const onDeleted = vi.fn();
	render(<App><RoleDeleteDialog role={customRoleFixture} onClose={vi.fn()} onDeleted={onDeleted} /></App>);
	expect(screen.getByText(/soft delete/)).toBeTruthy();
	expect(screen.getByText(/code cannot be reused/)).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Delete role" }));
	await screen.findByText("Role deleted");
	expect(deleteRole).toHaveBeenCalledWith("generated-role/42%");
	expect(onDeleted).toHaveBeenCalledTimes(1);
});
it("never offers deletion for a system role or without role:delete", () => {
	const props = { onClose: vi.fn(), onDeleted: vi.fn() };
	const view = render(<App><RoleDeleteDialog role={roleFixture} {...props} /></App>);
	expect(screen.queryByRole("dialog")).toBeNull();
	signInRoleActor(["role:read"]);
	view.rerender(<App><RoleDeleteDialog role={customRoleFixture} {...props} /></App>);
	expect(screen.queryByRole("dialog")).toBeNull();
});
it("shows the backend 409 and keeps the dialog open", async () => {
	vi.mocked(deleteRole).mockRejectedValue(new ApiError("Role is assigned to a user and cannot be deleted", 409));
	render(<App><RoleDeleteDialog role={customRoleFixture} onClose={vi.fn()} onDeleted={vi.fn()} /></App>);
	fireEvent.click(screen.getByRole("button", { name: "Delete role" }));
	expect(await screen.findByText("Role is assigned to a user and cannot be deleted")).toBeTruthy();
	expect(screen.getByRole("dialog")).toBeTruthy();
});
