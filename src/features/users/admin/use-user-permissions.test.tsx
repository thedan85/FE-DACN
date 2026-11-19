import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import type { MeData } from "@/features/auth/types";
import { useAuthStore } from "@/stores/auth-store";

import { useUserPermissions } from "./use-user-permissions";

/**
 * The hook's only job is to read the signed-in account and answer questions
 * about it. The permission arrays below mirror what `GET auth/me` returns for
 * the dev admin and a read-only account.
 */

const ADMIN_PERMISSIONS = [
	"user:create",
	"user:delete",
	"user:read",
	"user:update",
	"role:read",
];

const READ_ONLY_PERMISSIONS = ["user:read", "role:read"];

function signIn(permissions: string[]) {
	const user: MeData = {
		userId: "USR_test",
		email: "test@example.com",
		name: "Test",
		phone: null,
		address: null,
		roleCode: "admin",
		roleName: "Admin",
		permissions,
		hasPassword: true,
	};

	useAuthStore.setState({ user, status: "authenticated" });
}

afterEach(() => {
	cleanup();
	useAuthStore.setState({ user: null, status: "loading" });
});

it("grants every action to an account with all four codes", () => {
	signIn(ADMIN_PERMISSIONS);
	const { result } = renderHook(() => useUserPermissions());

	expect(result.current.can("user:read")).toBe(true);
	expect(result.current.can("user:create")).toBe(true);
	expect(result.current.can("user:update")).toBe(true);
	expect(result.current.can("user:delete")).toBe(true);
});

it("denies writes to a read-only account", () => {
	signIn(READ_ONLY_PERMISSIONS);
	const { result } = renderHook(() => useUserPermissions());

	expect(result.current.can("user:read")).toBe(true);
	expect(result.current.can("user:create")).toBe(false);
	expect(result.current.can("user:update")).toBe(false);
	expect(result.current.can("user:delete")).toBe(false);
});

it("answers false while no account is signed in", () => {
	useAuthStore.setState({ user: null, status: "anonymous" });
	const { result } = renderHook(() => useUserPermissions());

	expect(result.current.can("user:read")).toBe(false);
	expect(result.current.permissions).toBeUndefined();
});

it("re-answers when the account's permissions change", () => {
	signIn(READ_ONLY_PERMISSIONS);
	const { result } = renderHook(() => useUserPermissions());

	expect(result.current.can("user:create")).toBe(false);

	// A role change mid-session must not leave a stale "no".
	act(() => {
		signIn(ADMIN_PERMISSIONS);
	});

	expect(result.current.can("user:create")).toBe(true);
});

it("keeps a stable `can` identity across unrelated re-renders", () => {
	signIn(ADMIN_PERMISSIONS);
	const { result, rerender } = renderHook(() => useUserPermissions());
	const first = result.current.can;

	rerender();

	expect(result.current.can).toBe(first);
});
