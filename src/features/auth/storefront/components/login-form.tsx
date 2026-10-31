"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/auth/auth-controls";
import { GoogleAuthOption } from "@/components/auth/google-auth-option";
import { PasswordField } from "@/components/auth/password-field";
import { TextField } from "@/components/auth/text-field";
import { ApiError } from "@/lib/api/client";
import { getAuthErrorMessage, getMe, login } from "../../api/auth.api";
import { setAccessToken } from "../../session";
import { useAuthStore } from "@/stores/auth-store";
import { validateEmail, validateRequired } from "../model/validation";
import styles from "./auth-form.module.css";

type LoginFieldErrors = {
	email?: string;
	password?: string;
};

export function LoginForm() {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});

	function clearErrors() {
		setFieldErrors((current) =>
			current.email || current.password ? {} : current,
		);
		setError(null);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		const email = String(formData.get("email") ?? "").trim();
		const password = String(formData.get("password") ?? "");

		const emailError = validateEmail(email);
		const passwordError = validateRequired(password, "Password");

		if (emailError || passwordError) {
			setFieldErrors({
				email: emailError ?? undefined,
				password: passwordError ?? undefined,
			});
			setError(null);
			return;
		}

		setFieldErrors({});
		setError(null);
		setPending(true);

		try {
			const data = await login({ email, password });
			setAccessToken(data.accessToken);

			try {
				const user = await getMe();
				useAuthStore.setState({ user, status: "authenticated" });
			} catch {
				useAuthStore.setState({ user: null, status: "loading" });
			}

			router.replace("/");
		} catch (submitError) {
			if (submitError instanceof ApiError && submitError.status === 404) {
				setFieldErrors({ email: "The account does not exist" });
				return;
			}

			if (submitError instanceof ApiError && submitError.status === 401) {
				setFieldErrors({ password: "Invalid password" });
				return;
			}

			setError(getAuthErrorMessage(submitError));
		} finally {
			setPending(false);
		}
	}

	return (
		<form
			className={styles.form}
			onSubmit={handleSubmit}
			onChange={clearErrors}
			noValidate
		>
			<header className={styles.header}>
				<h1 className={styles.title}>Welcome Back</h1>
				<p className={styles.subtitle}>
					Sign in to continue managing your aquarium storefront.
				</p>
			</header>

			<div className={styles.fields}>
				<TextField
					id="login-email"
					name="email"
					type="email"
					label="Email"
					placeholder="Email"
					autoComplete="email"
					required
					error={fieldErrors.email}
					onBlur={(event) => {
						const value = event.target.value.trim();

						if (!value) {
							return;
						}

						const message = validateEmail(value);
						setFieldErrors((current) => ({
							...current,
							email: message ?? undefined,
						}));
					}}
				/>
				<PasswordField
					id="login-password"
					name="password"
					label="Password"
					placeholder="Password"
					autoComplete="current-password"
					required
					error={fieldErrors.password}
				/>
			</div>

			{error != null && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}

			<PrimaryButton disabled={pending}>
				{pending ? "Signing in..." : "Sign In"}
			</PrimaryButton>

			<GoogleAuthOption text="signin_with" onError={setError} />

			<p className={styles.footer}>
				Don&apos;t have an account?{" "}
				<Link href="/register" className={styles.footerLink}>
					Sign up
				</Link>
			</p>
		</form>
	);
}
