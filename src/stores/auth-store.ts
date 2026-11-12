"use client";

import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
import { getMe, logout, refreshSession } from "@/features/auth/api/auth.api";
import type { MeData } from "@/features/auth/types";
import {
	clearSession,
	getAccessToken,
	setAccessToken,
} from "@/features/auth/session";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthState = {
	user: MeData | null;
	status: AuthStatus;
	/**
	 * True once the refresh exchange has resolved, whether it produced a
	 * session or not. Cart/order data can start loading in parallel with
	 * `getMe()` instead of waiting for the profile.
	 */
	sessionReady: boolean;
	hydrate: () => Promise<void>;
	/**
	 * Re-reads the account from the server even when a session is already
	 * resolved, so a caller that must not act on stale state (the admin portal
	 * guard) can re-check the role on every mount.
	 */
	revalidate: () => Promise<void>;
	setUser: (user: MeData) => void;
	signOut: () => Promise<void>;
};

let hydration: Promise<void> | null = null;
let revalidation: Promise<void> | null = null;

/** A transport failure says nothing about whether the session is still valid. */
function isTransportError(error: unknown): boolean {
	return error instanceof ApiError && error.status === 0;
}

export const useAuthStore = create<AuthState>((set, get) => ({
	user: null,
	status: "loading",
	sessionReady: false,

	hydrate: () => {
		if (get().status === "authenticated") {
			return Promise.resolve();
		}

		if (hydration) {
			return hydration;
		}

		hydration = (async () => {
			try {
				const session = await refreshSession();
				setAccessToken(session.accessToken);
				set({ sessionReady: true });
				set({ user: await getMe(), status: "authenticated" });
			} catch {
				clearSession();
				set({ user: null, status: "anonymous", sessionReady: true });
			} finally {
				hydration = null;
			}
		})();

		return hydration;
	},

	revalidate: () => {
		if (revalidation) {
			return revalidation;
		}

		revalidation = (async () => {
			try {
				if (getAccessToken() !== null) {
					try {
						set({ user: await getMe(), status: "authenticated", sessionReady: true });
						return;
					} catch (error) {
						// Only an HTTP rejection proves the token is bad; a network
						// failure leaves the session unproven, not ended.
						if (isTransportError(error)) {
							throw error;
						}
					}
				}

				// No usable access token: exchange the refresh cookie for one.
				const session = await refreshSession();
				setAccessToken(session.accessToken);
				set({ sessionReady: true });
				set({ user: await getMe(), status: "authenticated" });
			} catch {
				clearSession();

				// Fail closed only when nothing was resolved: a transient failure
				// must not sign out an account that has already been confirmed.
				if (get().user === null) {
					set({ status: "anonymous", sessionReady: true });
				}
			} finally {
				revalidation = null;
			}
		})();

		return revalidation;
	},

	signOut: async () => {
		await logout();
		clearSession();
		set({ user: null, status: "anonymous" });
	},

	setUser: (user) => {
		set({ user, status: "authenticated" });
	},
}));
