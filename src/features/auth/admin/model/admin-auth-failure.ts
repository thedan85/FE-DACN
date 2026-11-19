import { ApiError } from "@/lib/api/client";
import { getAccessToken } from "@/features/auth/session";
import { useAuthStore } from "@/stores/auth-store";

export type AdminAuthFailureOutcome = "unhandled" | "unauthorized" | "forbidden";

/**
 * The narrow slice of the router this helper needs, so tests (and any future
 * non-Next caller) can pass a stub.
 */
type RouterLike = {
	replace: (href: string) => void;
};

/**
 * Shared handling for a rejected admin request.
 *
 * The backend enforces the same rules this UI reflects, so a 401/403 can
 * still arrive on a caller that allowed the action:
 *
 * - **401** — call the auth revalidation flow (re-checks the token, and the
 *   refresh exchange when it is gone). Only after it resolves, redirect to
 *   `/admin/login` when no access token remains; a session that rehydrates
 *   keeps the page.
 * - **403** — refresh permissions so the UI stops offering what the account
 *   may not do. Never redirects.
 *
 * Anything else returns `"unhandled"` untouched — a 409 or 500 is the caller's
 * to surface, not to retry.
 */
export async function handleAdminAuthFailure(
	error: unknown,
	router: RouterLike,
): Promise<AdminAuthFailureOutcome> {
	if (!(error instanceof ApiError)) {
		return "unhandled";
	}

	if (error.status === 401) {
		await useAuthStore.getState().revalidate();

		if (getAccessToken() === null) {
			router.replace("/admin/login");
		}

		return "unauthorized";
	}

	if (error.status === 403) {
		await useAuthStore.getState().revalidate();
		return "forbidden";
	}

	return "unhandled";
}

/**
 * True for a 401 that the revalidation absorbed: the session is still usable,
 * so a read may be retried manually. A 401 that cleared the token redirected
 * already and must not offer a retry on the page being left.
 */
export function recoveredAdminSession(
	outcome: AdminAuthFailureOutcome,
): boolean {
	return outcome === "unauthorized" && getAccessToken() !== null;
}

/** Shown when a write is refused because the account lacks the permission. */
export const ADMIN_FORBIDDEN_ACTION_MESSAGE =
	"You do not have permission to perform this action.";
/** Shown when a 401 stayed on the page because the session rehydrated. */
export const ADMIN_SESSION_REFRESHED_MESSAGE =
	"Your session was refreshed. Please try again.";

/**
 * The feedback copy for a rejected admin action, or `null` when none should
 * be shown. A 401 that redirects to `/admin/login` leaves no page for a
 * toast to land on, so it is suppressed; only the surviving (rehydrated)
 * session gets told to retry. `unhandled` stays the caller's own copy.
 */
export function adminAuthFailureFeedback(
	outcome: AdminAuthFailureOutcome,
): string | null {
	if (outcome === "forbidden") {
		return ADMIN_FORBIDDEN_ACTION_MESSAGE;
	}

	if (outcome === "unauthorized") {
		return getAccessToken() !== null ? ADMIN_SESSION_REFRESHED_MESSAGE : null;
	}

	return null;
}
