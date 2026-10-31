"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/auth/auth-controls";
import { GoogleAuthOption } from "@/components/auth/google-auth-option";
import { PasswordField } from "@/components/auth/password-field";
import { TextField } from "@/components/auth/text-field";
import { ApiError } from "@/lib/api/client";
import { getAuthErrorMessage, register } from "../../api/auth.api";
import { validateEmail, validateRequired } from "../model/validation";
import styles from "./auth-form.module.css";

const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

type RegisterFieldErrors = {
	name?: string;
	email?: string;
	phone?: string;
	password?: string;
	confirmPassword?: string;
};

export function RegisterForm() {
	const router = useRouter();
	const [agreed, setAgreed] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});

	function clearErrors() {
		setFieldErrors((current) =>
			Object.values(current).some(Boolean) ? {} : current,
		);
		setError(null);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		const name = String(formData.get("name") ?? "").trim();
		const email = String(formData.get("email") ?? "").trim();
		const phone = String(formData.get("phone") ?? "").trim();
		const password = String(formData.get("password") ?? "");
		const confirmPassword = String(formData.get("confirmPassword") ?? "");

		const nameError = validateRequired(name, "Full name");
		const emailError = validateEmail(email);
		const phoneError = !phone
			? "Phone is required."
			: PHONE_PATTERN.test(phone)
				? null
				: "Phone must be 10-15 digits, optionally starting with +.";
		const passwordError = !password
			? "Password is required."
			: password.length < 8
				? "Password must be at least 8 characters."
				: null;
		const confirmPasswordError = !confirmPassword
			? "Please confirm your password."
			: password !== confirmPassword
				? "Passwords do not match."
				: null;

		if (
			nameError ||
			emailError ||
			phoneError ||
			passwordError ||
			confirmPasswordError
		) {
			setFieldErrors({
				name: nameError ?? undefined,
				email: emailError ?? undefined,
				phone: phoneError ?? undefined,
				password: passwordError ?? undefined,
				confirmPassword: confirmPasswordError ?? undefined,
			});
			setError(null);
			return;
		}

		if (!agreed) {
			setFieldErrors({});
			setError("Please agree to the Terms of Service and Privacy Policy.");
			return;
		}

		setFieldErrors({});
		setError(null);
		setPending(true);

		try {
			await register({ name, email, phone, password });
			router.replace("/login");
		} catch (submitError) {
			if (submitError instanceof ApiError && submitError.status === 409) {
				setFieldErrors({
					email: "An account with this email already exists.",
				});
				return;
			}

			if (submitError instanceof ApiError && submitError.status === 400) {
				const message = submitError.message.toLowerCase();

				if (message.includes("email")) {
					setFieldErrors({
						email: "Enter a valid email address, e.g. name@example.com.",
					});
					return;
				}

				if (message.includes("phone")) {
					setFieldErrors({
						phone: "Phone must be 10-15 digits, optionally starting with +.",
					});
					return;
				}

				if (message.includes("password")) {
					setFieldErrors({
						password: "Password must be 8-128 characters.",
					});
					return;
				}

				if (message.includes("name")) {
					setFieldErrors({ name: "Full name is required." });
					return;
				}
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
				<h1 className={styles.title}>Create Account</h1>
				<p className={styles.subtitle}>
					Join to manage your aquascaping and livestock workflow.
				</p>
			</header>

			<div className={styles.fields}>
				<TextField
					id="register-full-name"
					name="name"
					label="Full name"
					placeholder="Full Name"
					autoComplete="name"
					required
					error={fieldErrors.name}
				/>
				<TextField
					id="register-email"
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
				<TextField
					id="register-phone"
					name="phone"
					type="tel"
					label="Phone"
					placeholder="Phone"
					autoComplete="tel"
					inputMode="tel"
					required
					error={fieldErrors.phone}
				/>
				<PasswordField
					id="register-password"
					name="password"
					label="Password"
					placeholder="Password"
					autoComplete="new-password"
					minLength={8}
					required
					error={fieldErrors.password}
				/>
				<PasswordField
					id="register-confirm-password"
					name="confirmPassword"
					label="Confirm password"
					placeholder="Confirm Password"
					autoComplete="new-password"
					minLength={8}
					required
					error={fieldErrors.confirmPassword}
				/>
			</div>

			<label className={styles.terms}>
				<input
					type="checkbox"
					name="terms"
					checked={agreed}
					onChange={(event) => setAgreed(event.target.checked)}
					className={styles.checkbox}
				/>
				<span>
					I agree to the Terms of Service and Privacy Policy
				</span>
			</label>

			{error != null && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}

			<PrimaryButton disabled={pending}>
				{pending ? "Creating account..." : "Create Account"}
			</PrimaryButton>

			<GoogleAuthOption
				text="signup_with"
				onError={setError}
				disabled={!agreed}
			/>

			<p className={styles.footer}>
				Already have an account?{" "}
				<Link href="/login" className={styles.footerLink}>
					Sign in
				</Link>
			</p>
		</form>
	);
}
