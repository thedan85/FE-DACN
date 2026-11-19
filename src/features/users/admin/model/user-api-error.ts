export {
	describeAdminApiFailure as describeUserApiFailure,
	SESSION_EXPIRED_MESSAGE,
	FORBIDDEN_MESSAGE,
	CONNECTION_ERROR_MESSAGE,
	type AdminApiFailure as UserApiFailure,
} from "@/lib/api/admin-api-error";

/**
 * One place that decides what a failed user API call means.
 *
 * The product screens repeat their own 401/403/transport handling; the user
 * screens cannot afford to, because every one of the six calls can end the
 * session. The pure part lives here; the hook in
 * `use-user-api-failure.ts` adds the redirect, so this module stays testable
 * without a router.
 *
 * The mapping:
 *
 * - `0` — the request never reached the server. The session is unproven, not
 *   ended, so the user gets a connection message and stays signed in.
 * - `401` — the token is gone or rejected. The only useful action is to sign
 *   out and go to the login screen; the caller performs that.
 * - `403` — the session is fine but the role lacks the permission. Hiding the
 *   control was cosmetic; this is the backend saying no.
 * - `404` — the row vanished between the list and the detail request. The
 *   detail and edit screens render a not-found result.
 * - Anything else — the backend's own message is the most specific thing
 *   available.
 */

/** The backend's sentence when the role a screen offered no longer exists. */
const STALE_ROLE_BACKEND_MESSAGE =
	"Invalid role; only employee and admin are supported";

/**
 * The replacement for the stale-role 409. The role list is loaded separately,
 * so a role can be deleted between the form opening and saving; "refresh and
 * try again" tells the user the fix, which the backend's wording does not.
 */
export const STALE_ROLE_CONFLICT_MESSAGE =
	"The selected role is not available. Refresh and try again.";

/**
 * The copy for a 409 on status, role, or delete. Every backend sentence is
 * shown as-is except the stale-role one, whose suggested action is out of
 * date; the caller puts the result in a notification.
 */
export function normalizeUserConflict(message: string): string {
	return message.trim().toLowerCase() ===
		STALE_ROLE_BACKEND_MESSAGE.toLowerCase()
		? STALE_ROLE_CONFLICT_MESSAGE
		: message;
}
