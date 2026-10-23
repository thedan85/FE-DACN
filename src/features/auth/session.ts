/**
 * Access token lives in memory only. The refresh token is an HttpOnly cookie,
 * so a reload restores the session through `refreshSession()` in the auth store.
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
