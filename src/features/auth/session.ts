/**
 * Access token lives in memory only. The refresh token is an HttpOnly cookie,
 * so a reload restores the session through `refreshSession()` in the auth store.
 */
let accessToken: string | null = null;
let sessionGeneration = 0;

export function setAccessToken(token: string) {
	sessionGeneration += 1;
	accessToken = token;
}

export function getAccessToken(): string | null {
	return accessToken;
}

export function getSessionGeneration(): number {
	return sessionGeneration;
}

/** Refreshing the current session must not invalidate its concurrent requests. */
export function updateAccessToken(token: string, generation: number): boolean {
	if (generation !== sessionGeneration || accessToken === null) {
		return false;
	}
	accessToken = token;
	return true;
}

export function clearSession() {
	sessionGeneration += 1;
	accessToken = null;
}

export function getAuthHeaders(): Record<string, string> {
	return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
