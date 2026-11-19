import type { ReactNode } from "react";
import { act, cleanup, renderHook, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getAccessToken, setAccessToken, clearSession } from "@/features/auth/session";
import type { MeData } from "@/features/auth/types";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { listAdminRoles } from "./api/roles.api";
import { useAdminRoles } from "./use-admin-roles";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./api/roles.api", () => ({ listAdminRoles: vi.fn() }));

const actor: MeData = {
	userId: "actor", name: "Actor", email: "actor@example.com", phone: null,
	address: null, roleCode: "employee", roleName: "Employee", hasPassword: true,
	permissions: ["user:create", "role:read"],
};
const role = { roleId: "custom", code: "support", name: "Support", description: null, system: false };
const wrapper = ({ children }: { children: ReactNode }) => <App>{children}</App>;

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(listAdminRoles).mockResolvedValue([role]);
	useAuthStore.setState({ user: actor, status: "authenticated" });
	setAccessToken("test-token");
});
afterEach(() => { cleanup(); clearSession(); useAuthStore.setState({ user: null, status: "anonymous" }); });

it("does not request roles without role:read and supplies the static options", () => {
	useAuthStore.setState({ user: { ...actor, permissions: ["user:create"] } });
	const { result } = renderHook(useAdminRoles, { wrapper });
	expect(listAdminRoles).not.toHaveBeenCalled();
	expect(result.current.loading).toBe(false);
	expect(result.current.usingFallback).toBe(true);
	expect(result.current.roles.map(({ code }) => code)).toEqual(["employee", "admin"]);
});

it("loads the returned roles when role:read is granted", async () => {
	const { result } = renderHook(useAdminRoles, { wrapper });
	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(listAdminRoles).toHaveBeenCalledTimes(1);
	expect(result.current.roles).toEqual([role]);
	expect(result.current.usingFallback).toBe(false);
});

it("clears the session and redirects on 401 instead of offering fallback roles", async () => {
	vi.mocked(listAdminRoles).mockRejectedValue(new ApiError("Unauthorized", 401));
	const { result } = renderHook(useAdminRoles, { wrapper });
	await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/login"));
	expect(useAuthStore.getState()).toMatchObject({ user: null, status: "anonymous" });
	expect(getAccessToken()).toBeNull();
	expect(await screen.findByText("Your session has ended")).toBeTruthy();
	expect(result.current.roles).toEqual([]);
	expect(result.current.usingFallback).toBe(false);
});

it.each([
	new ApiError("Forbidden", 403),
	new ApiError("Offline", 0),
	new ApiError("The role list response did not match the expected contract.", 500, { data: null }),
	new ApiError("The API returned a non-JSON response where JSON was expected.", 200, "invalid"),
])("uses static roles for a recoverable failure: %s", async (error) => {
	vi.mocked(listAdminRoles).mockRejectedValue(error);
	const { result } = renderHook(useAdminRoles, { wrapper });
	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.usingFallback).toBe(true);
	expect(result.current.roles.map(({ code }) => code)).toEqual(["employee", "admin"]);
	expect(router.replace).not.toHaveBeenCalled();
	expect(useAuthStore.getState().user).toEqual(actor);
});

it("surfaces an unexpected server error without silently using static roles", async () => {
	vi.mocked(listAdminRoles).mockRejectedValue(new ApiError("Role service unavailable", 503));
	const { result } = renderHook(useAdminRoles, { wrapper });
	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.usingFallback).toBe(false);
	expect(result.current.roles).toEqual([]);
	expect(await screen.findByText("Role service unavailable")).toBeTruthy();
});

it("keeps a successful empty role list empty", async () => {
	vi.mocked(listAdminRoles).mockResolvedValue([]);
	const { result } = renderHook(useAdminRoles, { wrapper });
	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.roles).toEqual([]);
	expect(result.current.usingFallback).toBe(false);
});

it("ignores an in-flight result after role:read is removed", async () => {
	let resolveRoles: (roles: typeof role[]) => void = () => {};
	vi.mocked(listAdminRoles).mockReturnValue(new Promise((resolve) => { resolveRoles = resolve; }));
	const { result } = renderHook(useAdminRoles, { wrapper });
	act(() => { useAuthStore.setState({ user: { ...actor, permissions: ["user:create"] } }); });
	await act(async () => { resolveRoles([role]); });
	expect(result.current.usingFallback).toBe(true);
	expect(result.current.roles.map(({ code }) => code)).toEqual(["employee", "admin"]);
});
