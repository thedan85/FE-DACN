"use client";

import { create } from "zustand";
import { getMe, logout, refreshSession } from "@/features/auth/api";
import type { MeData } from "@/features/auth/schemas";
import { clearSession, setAccessToken } from "@/features/auth/session";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthState = {
	user: MeData | null;
	status: AuthStatus;
	hydrate: () => Promise<void>;
	signOut: () => Promise<void>;
};

let hydration: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
	user: null,
	status: "loading",

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
				set({ user: await getMe(), status: "authenticated" });
			} catch {
				clearSession();
				set({ user: null, status: "anonymous" });
			} finally {
				hydration = null;
			}
		})();

		return hydration;
	},

	signOut: async () => {
		await logout();
		clearSession();
		set({ user: null, status: "anonymous" });
	},
}));
