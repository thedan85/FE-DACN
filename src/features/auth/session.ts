/**
 * Access token lives in memory only. The refresh token is an HttpOnly cookie,
 * so a reload can restore the session via `refreshSession()` later.
 *
 * ponytail: no auto-restore yet — add it when a protected route or auth-aware
 * header exists, otherwise it is a request on every page load for no visible UI.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string) {
	accessToken = token;
}

export function getAccessToken(): string | null {
	return accessToken;
}

export function clearSession() {
	accessToken = null;
}

export function getAuthHeaders(): Record<string, string> {
	return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
