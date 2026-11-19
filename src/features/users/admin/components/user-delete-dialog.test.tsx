import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { deleteAdminUser } from "../api/users.api";
import type { UserSummary } from "../schema/user.schema";
import { UserDeleteDialog } from "./user-delete-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("../api/users.api", () => ({ deleteAdminUser: vi.fn() }));

const user: UserSummary = {
	userId: "USR_alice", name: "Alice", email: "alice@example.com", phone: null,
	roleCode: "employee", roleName: "Employee", status: "ACTIVE", lastLogin: null,
	createdAt: "2026-10-12T00:00:00.000Z",
};

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

it.each(["success", "failure"])("locks Cancel during a single pending delete and recovers on %s", async (outcome) => {
	let resolveDelete: () => void = () => {};
	let rejectDelete: (error: unknown) => void = () => {};
	vi.mocked(deleteAdminUser).mockReturnValue(new Promise<void>((resolve, reject) => {
		resolveDelete = resolve;
		rejectDelete = reject;
	}));
	const onClose = vi.fn();
	const onDeleted = vi.fn();
	render(<App><UserDeleteDialog user={user} onClose={onClose} onDeleted={onDeleted} /></App>);
	const confirm = screen.getByRole("button", { name: "Delete user" });
	fireEvent.click(confirm);
	fireEvent.click(confirm);
	expect(deleteAdminUser).toHaveBeenCalledExactlyOnceWith("USR_alice");
	expect(within(confirm).getByRole("img", { name: "loading" })).toBeTruthy();
	const cancel = screen.getByRole("button", { name: "Keep user" });
	expect(cancel).toHaveProperty("disabled", true);
	fireEvent.click(cancel);
	fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", keyCode: 27 });
	expect(onClose).not.toHaveBeenCalled();

	await act(async () => {
		if (outcome === "success") resolveDelete();
		else rejectDelete(new ApiError("Delete unavailable", 500));
	});
	if (outcome === "success") {
		expect(onDeleted).toHaveBeenCalledExactlyOnceWith(user);
		expect(onClose).toHaveBeenCalledTimes(1);
	} else {
		expect(await screen.findByText("Delete unavailable")).toBeTruthy();
		expect(screen.getByRole("dialog")).toBeTruthy();
		expect(cancel).toHaveProperty("disabled", false);
		expect(onDeleted).not.toHaveBeenCalled();
		fireEvent.click(cancel);
		expect(onClose).toHaveBeenCalledTimes(1);
	}
});
