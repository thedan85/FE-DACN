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
