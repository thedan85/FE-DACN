"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/auth/auth-controls";
import { PasswordField } from "@/components/auth/password-field";
import { TextField } from "@/components/auth/text-field";
import { useAuthStore } from "@/stores/auth-store";
// Same rules as the storefront form: required email (format) + required password.
// Imported rather than copied so the two sign-in surfaces cannot drift apart.
import { validateEmail, validateRequired } from "../../storefront/model/validation";
import { getAuthErrorMessage, getMe, login } from "../../api/auth.api";
import { clearSession, setAccessToken } from "../../session";
import styles from "./admin-login-form.module.css";

type AdminLoginFieldErrors = {
	email?: string;
	password?: string;
};

/**
 * The only role without portal access — the backend's own discriminator.
 * Compared case-insensitively because `GET auth/me` returns the stored code
 * verbatim (`customer`, `admin`, …), while the backend's own check is
 * `equalsIgnoreCase("CUSTOMER")`.
 */
const CUSTOMER_ROLE_CODE = "CUSTOMER";

const COMPANY_ACCOUNTS_ONLY =
	"This portal is for company accounts only. Customer accounts sign in through the storefront.";

function isCustomerAccount(roleCode: string): boolean {
	return roleCode.toUpperCase() === CUSTOMER_ROLE_CODE;
}

/** Ends the session locally, whatever the server revocation did. */
function clearLocalSession() {
	clearSession();
	useAuthStore.setState({ user: null, status: "anonymous" });
}

/**
 * Revokes the session the login endpoint just created for a customer: the
 * store's sign-out flow (refresh-cookie revocation) with a local fallback.
 */
async function clearCustomerSession() {
	try {
		await useAuthStore.getState().signOut();
	} catch {
		// Revocation is best-effort; the local session ends regardless.
		clearLocalSession();
	}
}

/**
 * The design's controls come from the shared auth components
 * (`TextField`/`PasswordField`/`PrimaryButton`) so the form is pixel-identical
 * to the storefront login in the same Figma frame; an antd `Form`/`Input`
 * pair would need more override CSS than those components cost.
 */
export function AdminLoginForm() {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<AdminLoginFieldErrors>({});

	function clearErrors() {
		setFieldErrors((current) =>
			current.email || current.password ? {} : current,
		);
		setError(null);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (pending) {
			return;
		}

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

		let signedIn = false;

		try {
			const data = await login({ email, password });
			setAccessToken(data.accessToken);
			signedIn = true;

			const user = await getMe();

			if (isCustomerAccount(user.roleCode)) {
				await clearCustomerSession();
				setError(COMPANY_ACCOUNTS_ONLY);
				return;
			}

			useAuthStore.getState().setUser(user);
			router.replace("/admin/dashboard");
		} catch (submitError) {
			// A failure after `auth/login` succeeded (e.g. `auth/me` failing)
			// must not leave a half-established session behind.
			if (signedIn) {
				clearLocalSession();
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
				<h1 className={styles.title}>Store admin sign in</h1>
				<p className={styles.subtitle}>
					Sign in with your company account to manage the store.
				</p>
			</header>

			<div className={styles.fields}>
				<TextField
					id="admin-login-email"
					name="email"
					type="email"
					label="Email address"
					placeholder="Email address"
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
					id="admin-login-password"
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

			<PrimaryButton disabled={pending} aria-busy={pending}>
				{pending ? "Signing in..." : "Sign In"}
			</PrimaryButton>
		</form>
	);
}
