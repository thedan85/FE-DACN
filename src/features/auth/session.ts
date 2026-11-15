/**
 * Access token lives in memory only. The refresh token is an HttpOnly cookie,
 * so a reload restores the session through `refreshSession()` in the auth store.
 */
let accessToken: string | null = null;
let sessionGeneration = 0;
const sessionListeners = new Set<() => void>();

/** Notification only; consumers read the current generation without receiving tokens. */
export function onSessionChange(listener: () => void): () => void {
	sessionListeners.add(listener);
	let removed = false;
	return () => {
		if (removed) return;
		removed = true;
		sessionListeners.delete(listener);
	};
}

function notifySessionChange() {
	for (const listener of [...sessionListeners]) {
		if (!sessionListeners.has(listener)) continue;
		try {
			listener();
		} catch {
			// Observers must not interrupt session mutation or other consumers.
		}
	}
}

export function setAccessToken(token: string) {
	sessionGeneration += 1;
	accessToken = token;
	notifySessionChange();
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
	notifySessionChange();
}

export function getAuthHeaders(): Record<string, string> {
	return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
