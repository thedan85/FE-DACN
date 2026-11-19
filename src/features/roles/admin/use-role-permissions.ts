"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { hasRolePermission, type RolePermission } from "./model/permissions";

/** UI capability hints only; the backend independently authorizes each request. */
export function useRolePermissions() {
	const permissions = useAuthStore((state) => state.user?.permissions);
	const can = useCallback((permission: RolePermission) => hasRolePermission(permissions, permission), [permissions]);
	return { can, permissions };
}
