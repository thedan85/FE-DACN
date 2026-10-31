"use client";

import { useEffect, useState } from "react";
import {
	CheckCircleOutlined,
	EnvironmentOutlined,
	LockOutlined,
	MailOutlined,
	UserOutlined,
} from "@ant-design/icons";
import { App, Button, Input, Modal, Spin } from "antd";
import {
	changePassword,
	getAuthErrorMessage,
	updateProfile,
} from "@/features/auth/api/auth.api";
import type { MeData } from "@/features/auth/types";
import { ApiError } from "@/lib/api/client";
import { getInitials } from "@/lib/utils/initials";
import { useAuthStore } from "@/stores/auth-store";
import styles from "./page.module.css";

const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

type ProfileForm = {
	name: string;
	phone: string;
	address: string;
};

type ProfileErrors = Partial<Record<keyof ProfileForm, string>>;

type PasswordForm = {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
};

type PasswordErrors = Partial<Record<keyof PasswordForm, string>>;

const emptyPasswordForm: PasswordForm = {
	currentPassword: "",
	newPassword: "",
	confirmPassword: "",
};

function profileFromUser(user: MeData | null): ProfileForm {
	return {
		name: user?.name ?? "",
		phone: user?.phone ?? "",
		address: user?.address ?? "",
	};
}

function validateProfile(form: ProfileForm): ProfileErrors {
	const errors: ProfileErrors = {};
	const name = form.name.trim();
	const phone = form.phone.trim();

	if (!name) {
		errors.name = "Full name is required.";
	} else if (name.length > 255) {
		errors.name = "Full name must be 255 characters or fewer.";
	}

	if (!phone) {
		errors.phone = "Phone number is required.";
	} else if (!PHONE_PATTERN.test(phone)) {
		errors.phone = "Enter 10-15 digits, optionally starting with +.";
	}

	if (form.address.trim().length > 500) {
		errors.address = "Address must be 500 characters or fewer.";
	}

	return errors;
}

function validatePassword(form: PasswordForm): PasswordErrors {
	const errors: PasswordErrors = {};

	if (!form.currentPassword) {
		errors.currentPassword = "Enter your current password.";
	}

	if (!form.newPassword) {
		errors.newPassword = "Enter a new password.";
	} else if (form.newPassword.length < 8) {
		errors.newPassword = "Use at least 8 characters.";
	} else if (form.newPassword.length > 128) {
		errors.newPassword = "Use 128 characters or fewer.";
	}

	if (!form.confirmPassword) {
		errors.confirmPassword = "Confirm your new password.";
	} else if (form.confirmPassword !== form.newPassword) {
		errors.confirmPassword = "Passwords do not match.";
	}

	return errors;
}

export default function AccountPage() {
	const { user, status, hydrate, setUser } = useAuthStore();
	const { message } = App.useApp();

	const [form, setForm] = useState<ProfileForm>(() => profileFromUser(user));
	const [syncedUserId, setSyncedUserId] = useState(user?.userId ?? null);
	const [errors, setErrors] = useState<ProfileErrors>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const [passwordOpen, setPasswordOpen] = useState(false);
	const [passwordForm, setPasswordForm] =
		useState<PasswordForm>(emptyPasswordForm);
	const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [changingPassword, setChangingPassword] = useState(false);

	useEffect(() => {
		void hydrate();
	}, [hydrate]);

	// Re-sync the draft when the authenticated user changes (for example after
	// hydration) without an effect that would trigger a cascading render.
	if (user && syncedUserId !== user.userId) {
		setSyncedUserId(user.userId);
		setForm(profileFromUser(user));
		setErrors({});
		setFormError(null);
	}

	const initial = profileFromUser(user);
	const dirty =
		form.name !== initial.name ||
		form.phone !== initial.phone ||
		form.address !== initial.address;

	function updateProfileField(field: keyof ProfileForm, value: string) {
		setForm((current) => ({ ...current, [field]: value }));
		setErrors((current) => ({ ...current, [field]: undefined }));
		setFormError(null);
	}

	function handleReset() {
		setForm(profileFromUser(user));
		setErrors({});
		setFormError(null);
	}

	async function handleSave(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const nextErrors = validateProfile(form);
		if (Object.keys(nextErrors).length > 0) {
			setErrors(nextErrors);
			setFormError(null);
			return;
		}

		setErrors({});
		setFormError(null);
		setSaving(true);

		try {
			const updated = await updateProfile({
				name: form.name.trim(),
				phone: form.phone.trim(),
				address: form.address.trim(),
			});
			setUser(updated);
			setForm(profileFromUser(updated));
			setErrors({});
			message.success("Your profile has been updated.");
		} catch (error) {
			setFormError(getAuthErrorMessage(error));
		} finally {
			setSaving(false);
		}
	}

	function openPasswordModal() {
		setPasswordForm(emptyPasswordForm);
		setPasswordErrors({});
		setPasswordError(null);
		setPasswordOpen(true);
	}

	function closePasswordModal() {
		if (changingPassword) return;

		setPasswordOpen(false);
		setPasswordForm(emptyPasswordForm);
		setPasswordErrors({});
		setPasswordError(null);
	}

	function updatePasswordField(field: keyof PasswordForm, value: string) {
		setPasswordForm((current) => ({ ...current, [field]: value }));
		setPasswordErrors((current) => ({ ...current, [field]: undefined }));
		setPasswordError(null);
	}

	async function handleChangePassword() {
		const nextErrors = validatePassword(passwordForm);
		if (Object.keys(nextErrors).length > 0) {
			setPasswordErrors(nextErrors);
			setPasswordError(null);
			return;
		}

		setPasswordErrors({});
		setPasswordError(null);
		setChangingPassword(true);

		try {
			await changePassword({
				currentPassword: passwordForm.currentPassword,
				newPassword: passwordForm.newPassword,
			});
			message.success(
				"Password updated. Other devices have been signed out.",
			);
			setPasswordOpen(false);
			setPasswordForm(emptyPasswordForm);
		} catch (error) {
			if (
				error instanceof ApiError &&
				error.status === 401 &&
				error.message === "Invalid password"
			) {
				setPasswordErrors({
					currentPassword: "Current password is incorrect.",
				});
			} else {
				setPasswordError(getAuthErrorMessage(error));
			}
		} finally {
			setChangingPassword(false);
		}
	}

	if (status === "loading") {
		return (
			<div className={styles.loading}>
				<Spin size="large" />
			</div>
		);
	}

	if (status === "anonymous") {
		return (
			<section className={styles.guestState}>
				<div className="page-container">
					<div className={styles.guestCard}>
						<UserOutlined />
						<h1>My Account</h1>
						<p>Sign in to manage your profile, orders, and preferences.</p>
						<Button type="primary" href="/login">
							Log In
						</Button>
					</div>
				</div>
			</section>
		);
	}

	return (
		<section className={styles.accountPage}>
			<div className="page-container">
				<header className={`${styles.pageIntro} ${styles.pageIntroWithAction}`}>
					<div>
						<h1>My Account</h1>
						<p>Manage your profile, orders, and preferences.</p>
					</div>
					<Button href="/account/orders">Order History</Button>
				</header>

				<form
					className={styles.profileCard}
					onSubmit={handleSave}
					noValidate
				>
					<section className={styles.formSection}>
						<div className={styles.sectionHeading}>
							<h2>Personal Information</h2>
							<p>Keep your account details up to date.</p>
						</div>

						<div className={styles.identity}>
							<div className={styles.avatar} aria-hidden="true">
								{getInitials(user?.name)}
							</div>
							<div className={styles.identityText}>
								<strong>{user?.name || "Customer"}</strong>
								<span>{user?.roleName ?? "Customer"}</span>
							</div>
						</div>

						<div className={styles.fields}>
							<Field
								label="Full Name"
								htmlFor="account-name"
								className={styles.fullField}
								error={errors.name}
							>
								<Input
									id="account-name"
									name="name"
									value={form.name}
									onChange={(event) =>
										updateProfileField("name", event.target.value)
									}
									autoComplete="name"
									maxLength={255}
									status={errors.name ? "error" : undefined}
									aria-invalid={errors.name ? true : undefined}
								/>
							</Field>

							<Field
								label="Email Address"
								htmlFor="account-email"
								hint="Email cannot be changed."
							>
								<Input
									id="account-email"
									name="email"
									value={user?.email ?? ""}
									prefix={<MailOutlined />}
									readOnly
									aria-describedby="account-email-hint"
								/>
							</Field>

							<Field
								label="Phone Number"
								htmlFor="account-phone"
								error={errors.phone}
							>
								<Input
									id="account-phone"
									name="phone"
									value={form.phone}
									onChange={(event) =>
										updateProfileField("phone", event.target.value)
									}
									autoComplete="tel"
									inputMode="tel"
									maxLength={16}
									status={errors.phone ? "error" : undefined}
									aria-invalid={errors.phone ? true : undefined}
								/>
							</Field>
						</div>
					</section>

					<section className={styles.formSection}>
						<div className={styles.sectionHeading}>
							<h2>
								<EnvironmentOutlined /> Address Information
							</h2>
							<p>Your default address for a smoother checkout.</p>
						</div>

						<div className={styles.fields}>
							<Field
								label="Address"
								htmlFor="account-address"
								className={styles.fullField}
								hint="Street, city, district, and postal code."
								error={errors.address}
							>
								<Input.TextArea
									id="account-address"
									name="address"
									value={form.address}
									onChange={(event) =>
										updateProfileField("address", event.target.value)
									}
									autoComplete="street-address"
									rows={3}
									maxLength={500}
									aria-invalid={errors.address ? true : undefined}
								/>
							</Field>
						</div>
					</section>

					{user?.hasPassword !== false && (
						<section className={`${styles.formSection} ${styles.securitySection}`}>
							<div className={styles.securityHeading}>
								<div className={styles.sectionHeading}>
									<h2>
										<LockOutlined /> Account Security
									</h2>
									<p>Password</p>
								</div>
								<button
									type="button"
									className={styles.changePassword}
									onClick={openPasswordModal}
								>
									Change Password
								</button>
							</div>
							<div className={styles.securityRow}>
								<span aria-hidden="true">••••••••••••</span>
								<span className={styles.verified}>
									<CheckCircleOutlined /> Verified
								</span>
							</div>
						</section>
					)}

					{formError != null && (
						<p className={styles.formError} role="alert">
							{formError}
						</p>
					)}

					<div className={styles.actions}>
						<Button
							type="primary"
							htmlType="submit"
							loading={saving}
							disabled={!dirty || saving}
						>
							Save Changes
						</Button>
						<Button
							htmlType="button"
							onClick={handleReset}
							disabled={!dirty || saving}
						>
							Cancel
						</Button>
						<small>Your changes are only applied when you save.</small>
					</div>
				</form>
			</div>

			<Modal
				open={passwordOpen}
				title="Change Password"
				centered
				okText="Update Password"
				cancelText="Cancel"
				onOk={handleChangePassword}
				onCancel={closePasswordModal}
				confirmLoading={changingPassword}
				mask={{ closable: !changingPassword }}
			>
				<p className={styles.passwordIntro}>
					Choose a new password. Other devices signed in to your account
					will be signed out.
				</p>

				<div className={styles.passwordFields}>
					<Field
						label="Current Password"
						htmlFor="current-password"
						error={passwordErrors.currentPassword}
					>
						<Input.Password
							id="current-password"
							value={passwordForm.currentPassword}
							onChange={(event) =>
								updatePasswordField("currentPassword", event.target.value)
							}
							autoComplete="current-password"
							autoFocus
							status={
								passwordErrors.currentPassword ? "error" : undefined
							}
							aria-invalid={
								passwordErrors.currentPassword ? true : undefined
							}
						/>
					</Field>

					<Field
						label="New Password"
						htmlFor="new-password"
						hint="At least 8 characters."
						error={passwordErrors.newPassword}
					>
						<Input.Password
							id="new-password"
							value={passwordForm.newPassword}
							onChange={(event) =>
								updatePasswordField("newPassword", event.target.value)
							}
							autoComplete="new-password"
							maxLength={128}
							status={passwordErrors.newPassword ? "error" : undefined}
							aria-invalid={
								passwordErrors.newPassword ? true : undefined
							}
						/>
					</Field>

					<Field
						label="Confirm New Password"
						htmlFor="confirm-password"
						error={passwordErrors.confirmPassword}
					>
						<Input.Password
							id="confirm-password"
							value={passwordForm.confirmPassword}
							onChange={(event) =>
								updatePasswordField("confirmPassword", event.target.value)
							}
							autoComplete="new-password"
							maxLength={128}
							status={
								passwordErrors.confirmPassword ? "error" : undefined
							}
							aria-invalid={
								passwordErrors.confirmPassword ? true : undefined
							}
						/>
					</Field>
				</div>

				{passwordError != null && (
					<p className={styles.formError} role="alert">
						{passwordError}
					</p>
				)}
			</Modal>
		</section>
	);
}

function Field({
	label,
	htmlFor,
	className,
	error,
	hint,
	children,
}: {
	label: string;
	htmlFor: string;
	className?: string;
	error?: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<div className={`${styles.field} ${className ?? ""}`}>
			<label htmlFor={htmlFor}>{label}</label>
			{children}
			{hint != null && (
				<span id={`${htmlFor}-hint`} className={styles.hint}>
					{hint}
				</span>
			)}
			{error != null && (
				<span className={styles.fieldError} role="alert">
					{error}
				</span>
			)}
		</div>
	);
}
