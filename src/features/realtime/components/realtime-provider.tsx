"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { realtimeManager } from "../connection-manager";

export function RealtimeProvider() {
	const accountId = useAuthStore((state) => state.user?.userId ?? null);
	const status = useAuthStore((state) => state.status);

	useEffect(() => {
		realtimeManager.start();
		return () => realtimeManager.stop();
	}, []);

	useEffect(() => {
		if (status === "loading") {
			return;
		}
		realtimeManager.setAccount(accountId);
	}, [accountId, status]);

	return null;
}
