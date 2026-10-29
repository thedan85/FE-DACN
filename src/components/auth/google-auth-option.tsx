"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Divider } from "@/components/auth/auth-controls";
import { getAuthErrorMessage, getMe, loginWithGoogle } from "@/features/auth/api";
import { setAccessToken } from "@/features/auth/session";
import { getPublicEnv } from "@/lib/env";
import { useAuthStore } from "@/stores/auth-store";
import styles from "./google-auth-option.module.css";

type GoogleCredentialResponse = { credential?: string };

type GoogleAccountsId = {
	initialize: (config: {
		client_id: string;
		callback: (response: GoogleCredentialResponse) => void;
	}) => void;
	renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
};

declare global {
	interface Window {
		google?: { accounts: { id: GoogleAccountsId } };
	}
}

type Props = {
	text: "signin_with" | "signup_with";
	onError: (message: string) => void;
	disabled?: boolean;
};

export function GoogleAuthOption(props: Props) {
	const clientId = getPublicEnv().NEXT_PUBLIC_GOOGLE_CLIENT_ID;
	return clientId ? <GoogleAuthOptionInner clientId={clientId} {...props} /> : null;
}

function GoogleAuthOptionInner({
	clientId,
	text,
	onError,
	disabled = false,
}: Props & { clientId: string }) {
	const router = useRouter();
	const buttonRef = useRef<HTMLDivElement>(null);
	const disabledRef = useRef(disabled);
	const [pending, setPending] = useState(false);

	// The GIS callback is registered once; read the latest value through a ref.
	useEffect(() => {
		disabledRef.current = disabled;
	}, [disabled]);

	async function handleCredential(response: GoogleCredentialResponse) {
		if (disabledRef.current) {
			onError("Please accept the terms before continuing with Google.");
			return;
		}
		if (!response.credential) {
			onError("Google sign-in was cancelled.");
			return;
		}

		setPending(true);
		try {
			const data = await loginWithGoogle(response.credential);
			setAccessToken(data.accessToken);

			try {
				const user = await getMe();
				useAuthStore.getState().setUser(user);
			} catch {
				// The session cookie is already issued; let the store hydrate
				// on the next page instead of reporting a failed login.
				useAuthStore.setState({ user: null, status: "loading" });
			}

			router.replace("/");
		} catch (error) {
			onError(getAuthErrorMessage(error));
		} finally {
			setPending(false);
		}
	}

	function renderButton() {
		const container = buttonRef.current;
		if (!container || !window.google) {
			return;
		}

		container.replaceChildren();
		window.google.accounts.id.initialize({
			client_id: clientId,
			callback: handleCredential,
		});
		window.google.accounts.id.renderButton(container, {
			type: "standard",
			theme: "outline",
			size: "large",
			text,
			width: Math.min(container.clientWidth || 360, 400),
		});
	}

	return (
		<>
			<Divider />
			<div
				ref={buttonRef}
				className={styles.wrapper}
				aria-busy={pending || disabled}
				inert={pending || disabled}
			/>
			<Script
				src="https://accounts.google.com/gsi/client"
				strategy="afterInteractive"
				onReady={renderButton}
				onError={() => onError("Google sign-in could not load. Check your connection or any ad blocker.")}
			/>
		</>
	);
}
