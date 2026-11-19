"use client";

import { useCallback } from "react";

import { useAuthStore } from "@/stores/auth-store";

import {
	hasUserPermission,
	type UserPermission,
} from "./model/permissions";

/**
 * Reads the signed-in account's permissions and answers "may I?" for the user
 * account actions this feature gates on.
 *
 * Scoped to users on purpose: the account's authority list is global, but which
 * codes this feature knows about is not, so it does not inherit the catalog
 * hook's vocabulary.
 *
 * The permissions come from `GET auth/me`, resolved by the auth store before
 * the portal shell mounts, so a component using this is already past the
 * guard. An unresolved or anonymous account holds nothing, and every check
 * answers `false` rather than assuming access.
 *
 * The answer is a UI hint only — the backend enforces the same rule and
 * answers 403 — so a caller must still handle that failure.
 */
export function useUserPermissions() {
	// Select the array itself (not the whole user object) so the component only
	// re-renders when the permission set actually changes.
	const permissions = useAuthStore((state) => state.user?.permissions);

	const can = useCallback(
		(permission: UserPermission) =>
			hasUserPermission(permissions, permission),
		[permissions],
	);

	return { can, permissions };
}
