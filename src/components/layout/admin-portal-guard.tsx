"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Spin } from "antd";
import { isCompanyAccount } from "@/features/auth/model/access";
import { useAuthStore } from "@/stores/auth-store";
import styles from "./admin-portal-guard.module.css";

/** The portal's entry point, and the only place a blocked session is sent. */
const ADMIN_LOGIN_PATH = "/admin/login";

/**
 * How long a mount waits for the account before failing closed. Without this a
 * stalled `auth/me` (no request timeout in the API client) would leave the gate
 * spinning forever, which is the one failure mode worse than a redirect.
 */
const SESSION_CHECK_TIMEOUT_MS = 10_000;

type AdminPortalGuardProps = {
	children: ReactNode;
};

/**
 * Client-side gate for every `/admin/*` shell route (no `middleware.ts` exists —
 * see the spec's Implementation Decisions).
 *
 * Every mount re-asks the server who the account is before the shell is allowed
 * to render, so a tab left open after a revocation cannot keep showing the
 * portal (story 10). Children mount only once that check has confirmed a
 * company account, so a guest never sees protected content, not even a frame.
 */
export function AdminPortalGuard({ children }: AdminPortalGuardProps) {
	const router = useRouter();
	const user = useAuthStore((state) => state.user);
	const revalidate = useAuthStore((state) => state.revalidate);
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		let active = true;

		const timeout = setTimeout(() => {
			if (active) {
				setChecking(false);
			}
		}, SESSION_CHECK_TIMEOUT_MS);

		void revalidate().finally(() => {
			if (!active) {
				return;
			}

			clearTimeout(timeout);
			setChecking(false);
		});

		return () => {
			active = false;
			clearTimeout(timeout);
		};
	}, [revalidate]);

	const allowed = !checking && isCompanyAccount(user);

	useEffect(() => {
		if (checking || allowed) {
			return;
		}

		router.replace(ADMIN_LOGIN_PATH);
	}, [checking, allowed, router]);

	if (!allowed) {
		return (
			<main
				className={styles.gate}
				aria-busy="true"
				aria-label="Checking your session"
			>
				<Spin size="large" />
			</main>
		);
	}

	return <>{children}</>;
}
