"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { App } from "antd";
import { clearSession } from "@/features/auth/session";
import { useAuthStore } from "@/stores/auth-store";
import { describeAdminApiFailure, SESSION_EXPIRED_MESSAGE } from "@/lib/api/admin-api-error";

/** A rejected session is cleared locally, never by a second logout request. */
export function useAdminApiFailure() {
	const router = useRouter();
	const { message } = App.useApp();
	return useCallback((caught: unknown, fallback: string) => {
		const failure = describeAdminApiFailure(caught, fallback);
		if (failure.kind === "session-expired") {
			clearSession();
			useAuthStore.setState({ user: null, status: "anonymous" });
			message.warning(SESSION_EXPIRED_MESSAGE);
			router.replace("/admin/login");
		}
		return failure;
	}, [router, message]);
}
