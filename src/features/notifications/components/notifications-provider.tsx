"use client";

import { useEffect } from "react";
import { realtimeManager } from "@/features/realtime/connection-manager";
import { useAuthStore } from "@/stores/auth-store";
import { useNotificationStore } from "../store";

/** One provider registers the single inbox consumer; it owns no transport or timer. */
export function NotificationsProvider() {
	const status = useAuthStore((state) => state.status);

	useEffect(() => {
		if (status === "loading") {
			return;
		}
		if (status !== "authenticated") {
			useNotificationStore.getState().dispose();
			return;
		}
		return useNotificationStore.getState().configure(realtimeManager);
	}, [status]);

	return null;
}
