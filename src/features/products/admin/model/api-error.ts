import { ApiError } from "@/lib/api/client";

/**
 * The message to show the user for a failed catalog request.
 *
 * Two kinds of failure reach a component, and only one of them has anything
 * worth repeating:
 *
 * - **An HTTP response** (`status > 0`) carries the backend's own words — a 409's
 *   `resource already exists…`, a 400's validation text. Those are more useful
 *   than anything the UI could invent, because they name the actual problem.
 * - **A transport failure** (`status === 0`) has no meaningful text; the
 *   `fetch` error says the connection dropped, which tells the user nothing they
 *   can act on. So each caller passes the fallback that fits its action.
 *
 * Mirrors `getAuthErrorMessage` in the auth feature, which does the same for
 * sign-in: the rule is shared, the wording is not, so the fallback is a
 * parameter here.
 */
export function apiErrorMessage(caught: unknown, fallback: string): string {
	return caught instanceof ApiError && caught.status > 0
		? caught.message
		: fallback;
}

/**
 * True when the server rejected the request because the value is already taken.
 *
 * Only the caller knows which field a 409 belongs to — a variant's is its SKU, a
 * product's is its slug — so this answers the question and leaves the placement
 * to the call site.
 */
export function isConflict(caught: unknown): caught is ApiError {
	return caught instanceof ApiError && caught.status === 409;
}
