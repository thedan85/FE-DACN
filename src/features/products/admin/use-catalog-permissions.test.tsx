import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { useAuthStore } from "@/stores/auth-store";
import type { MeData } from "@/features/auth/types";
import { useCatalogPermissions } from "./use-catalog-permissions";

/**
 * The hook's only job is to read the signed-in account and answer questions
 * about it. The permission arrays below are copied from `GET auth/me` against
 * the dev backend, so the two roles the acceptance criteria name are tested
 * with what they actually hold.
 */

/** `swagger.admin@example.com` — full catalog rights. */
const ADMIN_PERMISSIONS = [
	"product:create",
	"product:read",
	"product:update",
	"product:delete",
	"category:create",
	"category:read",
	"category:update",
	"category:delete",
	"variant:create",
	"variant:read",
	"variant:update",
	"variant:delete",
	"attribute:create",
	"attribute:read",
	"attribute:update",
	"attribute:delete",
	"attribute-value:create",
	"attribute-value:read",
	"attribute-value:update",
	"attribute-value:delete",
	"media:create",
	"media:read",
	"media:update",
	"media:delete",
	"order:read",
	"order:update",
	"order:complete",
];

/** `swagger.customer@example.com` — read-only catalog rights. */
const CUSTOMER_PERMISSIONS = [
	"product:read",
	"category:read",
	"variant:read",
	"attribute:read",
	"attribute-value:read",
	"media:read",
];

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

it("grants the dev admin its catalog permissions", () => {
	signIn(ADMIN_PERMISSIONS);
	const { result } = renderHook(() => useCatalogPermissions());

	expect(result.current.can("product:create")).toBe(true);
	expect(result.current.can("product:update")).toBe(true);
	expect(result.current.can("product:delete")).toBe(true);
	expect(result.current.can("media:create")).toBe(true);
});

it("denies the dev customer every catalog write", () => {
	signIn(CUSTOMER_PERMISSIONS);
	const { result } = renderHook(() => useCatalogPermissions());

	expect(result.current.can("product:create")).toBe(false);
	expect(result.current.can("product:update")).toBe(false);
	expect(result.current.can("product:delete")).toBe(false);
	expect(result.current.can("variant:create")).toBe(false);
	expect(result.current.can("media:create")).toBe(false);
});

it("answers false while no account is signed in", () => {
	useAuthStore.setState({ user: null, status: "anonymous" });
	const { result } = renderHook(() => useCatalogPermissions());

	expect(result.current.can("product:create")).toBe(false);
	expect(result.current.permissions).toBeUndefined();
});

it("re-answers when the account's permissions change", () => {
	signIn(CUSTOMER_PERMISSIONS);
	const { result } = renderHook(() => useCatalogPermissions());

	expect(result.current.can("product:create")).toBe(false);

	// A role change mid-session must not leave a stale "no".
	act(() => {
		signIn(ADMIN_PERMISSIONS);
	});

	expect(result.current.can("product:create")).toBe(true);
});

it("keeps a stable `can` identity across unrelated re-renders", () => {
	signIn(ADMIN_PERMISSIONS);
	const { result, rerender } = renderHook(() => useCatalogPermissions());
	const first = result.current.can;

	rerender();

	// `can` is memoised on the permission array, so passing it into a dependency
	// list (an antd menu, a useMemo) cannot cause a render loop.
	expect(result.current.can).toBe(first);
});

it("answers false for a half-hydrated store instead of throwing", () => {
	// The store starts at `status: "loading"` with `user: null`. Reading a
	// permission off that must answer false rather than dereferencing null.
	useAuthStore.setState({ user: null, status: "loading" });

	const { result } = renderHook(() => useCatalogPermissions());

	expect(result.current.can("product:delete")).toBe(false);
	expect(result.current.permissions).toBeUndefined();
});
