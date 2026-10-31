"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Divider } from "@/components/auth/auth-controls";
import { getAuthErrorMessage, getMe, loginWithGoogle } from "@/features/auth/api/auth.api";
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
	prompt: () => void;
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
	return <GoogleAuthOptionInner clientId={clientId} {...props} />;
}

function GoogleAuthOptionInner({
	clientId,
	text,
	onError,
	disabled = false,
}: Props & { clientId?: string }) {
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
			client_id: clientId!,
			callback: handleCredential,
		});
		window.google.accounts.id.renderButton(container, {
			type: "standard",
			theme: "outline",
			shape: "pill",
			size: "large",
			text,
			width: container.clientWidth || 360,
		});
		// The visible custom button is the keyboard control; this layer is
		// invisible and only exists to open the real Google consent popup.
		container.querySelector("iframe")?.setAttribute("tabindex", "-1");
	}

	function handleClick() {
		if (!clientId) {
			onError(
				"Google sign-in is not available right now. Use email and password instead.",
			);
			return;
		}
		window.google?.accounts.id.prompt();
	}

	const label =
		text === "signup_with" ? "Sign up with Google" : "Continue with Google";

	return (
		<>
			<Divider />
			<div
				className={styles.wrapper}
				aria-busy={pending || disabled}
				inert={pending || disabled}
			>
				<button
					type="button"
					className={styles.button}
					onClick={handleClick}
					disabled={pending}
				>
					<GoogleMark />
					<span>{pending ? "Please wait..." : label}</span>
				</button>
				{clientId && (
					<div ref={buttonRef} className={styles.gsi} aria-hidden="true" />
				)}
			</div>
			{clientId && (
				<Script
					src="https://accounts.google.com/gsi/client"
					strategy="afterInteractive"
					onReady={renderButton}
					onError={() => onError("Google sign-in could not load. Check your connection or any ad blocker.")}
				/>
			)}
		</>
	);
}

function GoogleMark() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 48 48"
			aria-hidden="true"
			focusable="false"
		>
			<path
				fill="#EA4335"
				d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
			/>
			<path
				fill="#4285F4"
				d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
			/>
			<path
				fill="#FBBC05"
				d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
			/>
			<path
				fill="#34A853"
				d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
			/>
		</svg>
	);
}
