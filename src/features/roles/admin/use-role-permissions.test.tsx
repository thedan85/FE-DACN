import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useAuthStore } from "@/stores/auth-store";
import { useRolePermissions } from "./use-role-permissions";

afterEach(() => { cleanup(); useAuthStore.setState({ user: null, status: "anonymous" }); });

it("fails closed for an anonymous account", () => {
	useAuthStore.setState({ user: null, status: "anonymous" });
	const { result } = renderHook(useRolePermissions);
	expect(result.current.can("role:read")).toBe(false);
});

it("updates exact-match role capabilities with the signed-in account", () => {
	const user = { userId: "actor", email: "actor@example.com", name: "Actor", phone: null, address: null, roleCode: "support", roleName: "Support", hasPassword: true, permissions: ["role:read"] };
	useAuthStore.setState({ user, status: "authenticated" });
	const { result } = renderHook(useRolePermissions);
	expect(result.current.can("role:read")).toBe(true);
	expect(result.current.can("role:update")).toBe(false);
	act(() => useAuthStore.setState({ user: { ...user, permissions: ["role:update"] } }));
	expect(result.current.can("role:read")).toBe(false);
	expect(result.current.can("role:update")).toBe(true);
	expect(result.current.can("role:delete")).toBe(false);
});
