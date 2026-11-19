"use client";

import { useEffect, useState } from "react";
import { App } from "antd";
import { useAdminApiFailure } from "@/hooks/use-admin-api-failure";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

import { listAdminRoles } from "./api/roles.api";
import { FALLBACK_STAFF_ROLES } from "./model/roles";
import type { Role } from "./schema/user.schema";

type AdminRolesState = {
	roles: Role[];
	loading: boolean;
	/** True when the select is using the built-in staff options. */
	usingFallback: boolean;
};

const EMPTY_ROLES: AdminRolesState = { roles: [], loading: false, usingFallback: false };
const STATIC_ROLES: AdminRolesState = { roles: [...FALLBACK_STAFF_ROLES], loading: false, usingFallback: true };

/**
 * Loads the role list for the user screens' selects.
 *
 * Without role:read, use the built-in staff options without making a doomed
 * request. A 403, transport failure or invalid response also permits that
 * fallback; a 401 must end the session through the shared failure handler.
 *
 * Consumers that assign roles must filter `customer` out themselves — the list
 * endpoint returns every role, and only the create/edit controls have the
 * staff-only rule.
 */
export function useAdminRoles(): AdminRolesState {
	const permissions = useAuthStore((state) => state.user?.permissions);
	const canRead = permissions?.includes("role:read") ?? false;
	const handleFailure = useAdminApiFailure();
	const { message } = App.useApp();
	const [state, setState] = useState<AdminRolesState>({
		roles: [],
		loading: true,
		usingFallback: false,
	});

	useEffect(() => {
		if (!canRead) return;
		let active = true;

		listAdminRoles()
			.then((roles) => {
				if (!active) {
					return;
				}

				setState({
					roles,
					loading: false,
					usingFallback: false,
				});
			})
			.catch((caught: unknown) => {
				if (!active) return;
				const failure = handleFailure(caught, "We couldn't load roles. Try again.");
				// parseOrThrow uses 500 for a malformed JSON contract; apiFetch
				// retains the successful HTTP status for a non-JSON response.
				const contractError = caught instanceof ApiError && (
					(caught.status === 500 && caught.message === "The role list response did not match the expected contract.") ||
					(caught.status >= 200 && caught.status < 300)
				);
				if (failure.kind === "forbidden" || failure.kind === "connection" || contractError) {
					setState(STATIC_ROLES);
				} else {
					setState(EMPTY_ROLES);
					if (failure.kind !== "session-expired") message.error(failure.message);
				}
			});

		return () => {
			active = false;
		};
	}, [canRead, handleFailure, message]);

	if (!permissions) return EMPTY_ROLES;
	return canRead ? state : STATIC_ROLES;
}
