"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	Alert,
	App,
	Button,
	Card,
	Form,
	Input,
	Result,
	Select,
	Typography,
} from "antd";
import {
	ArrowLeftOutlined,
	CheckCircleFilled,
	MinusCircleOutlined,
} from "@ant-design/icons";

import { AdminTheme } from "@/components/layout/admin-theme";
import { ApiError } from "@/lib/api/client";

import { createAdminUser } from "../api/users.api";
import {
	CREATE_FORM_ERROR,
	classifyCreateConflict,
	parseCreateValidationError,
	type UserFormField,
} from "../model/create-errors";
import { ROLE_FALLBACK_HINT, staffRoles, validateKnownStaffRoleCode } from "../model/roles";
import { displayName } from "../model/user-format";
import {
	PASSWORD_MAX_BYTES,
	PASSWORD_MIN_LENGTH,
	USER_ADDRESS_MAX_LENGTH,
	USER_EMAIL_MAX_LENGTH,
	USER_NAME_MAX_LENGTH,
	passwordChecklist,
	passwordStrength,
	passwordStrengthLabel,
	toCreateAdminUserInput,
	validateUserAddress,
	validateUserEmail,
	validateUserName,
	validateUserPassword,
	validateUserPhone,
	type UserCreateFormValues,
} from "../model/user-create-form";
import { useUserApiFailure } from "../model/use-user-api-failure";
import { USER_PERMISSIONS } from "../model/permissions";
import { useAdminRoles } from "../use-admin-roles";
import { useUserPermissions } from "../use-user-permissions";
import styles from "./user-create-form.module.css";

const { Title, Text } = Typography;

/** Where the sidebar's "User accounts" item points. */
const LISTING_PATH = "/admin/users";

const DEFAULT_ROLE = "employee";

type SaveState =
	| { status: "idle" }
	| { status: "saving" }
	| { status: "error"; message: string };

/**
 * Create an admin user.
 *
 * The form only collects what `POST admin/users` accepts: the profile text, a
 * staff role, and a password. The customer role is not offered — the backend
 * rejects it here because customers register through the storefront. Status is
 * not collected either; a new account is active by definition, and locking it
 * belongs on the edit screen.
 *
 * A 400 from the backend is one semicolon-joined sentence, so it is split back
 * onto the fields that caused it (`create-errors.ts`). A duplicate email is the
 * only 409 that names a field; everything else stays in the banner.
 */
export function UserCreateForm() {
	const router = useRouter();
	const { notification } = App.useApp();
	const { can } = useUserPermissions();
	const mayCreate = can(USER_PERMISSIONS.create);
	const { roles, loading: rolesLoading, usingFallback } = useAdminRoles();
	const handleFailure = useUserApiFailure();

	const [form] = Form.useForm<UserCreateFormValues>();
	const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
	/** The live password, watched from the connected form for the advice meter. */
	const watchedPassword = Form.useWatch("password", form) as
		| string
		| undefined;
	const password = watchedPassword ?? "";

	const staffRoleOptions = staffRoles(roles).map((role) => ({
		value: role.code,
		label: role.name,
	}));

	// `useAdminRoles` starts empty while the request is in flight, so the form
	// begins on the built-in employee code. If the real list ever omits that
	// code, fall back to its first staff role rather than leaving the select on
	// a value it cannot render. The guard matters as well as the data: without
	// `user:create` no Form is rendered, and touching the instance then is what
	// produced the "not connected to any Form element" warning.
	useEffect(() => {
		if (!mayCreate || rolesLoading) {
			return;
		}

		const available = staffRoles(roles).map((role) => role.code);
		const current = form.getFieldValue("role") as string | undefined;

		if (!current || !available.includes(current)) {
			form.setFieldValue("role", available[0] ?? DEFAULT_ROLE);
		}
	}, [mayCreate, rolesLoading, roles, form]);

	const saving = saveState.status === "saving";

	async function handleFinish(values: UserCreateFormValues) {
		// `loading` on the button is visual only: Enter in a text field and a
		// rapid double click both submit, and two POSTs would create two users.
		if (saveState.status === "saving") {
			return;
		}

		setSaveState({ status: "saving" });

		try {
			const created = await createAdminUser(toCreateAdminUserInput(values));

			notification.success({
				title: "User created",
				description: `${displayName(created)} can now sign in with the password you set.`,
			});

			router.push(`${LISTING_PATH}/${encodeURIComponent(created.userId)}`);
		} catch (caught) {
			const apiError = caught instanceof ApiError ? caught : null;

			if (apiError?.status === 400) {
				const parsed = parseCreateValidationError(apiError.message);
				const fieldErrors = (
					Object.entries(parsed.fields) as Array<[UserFormField, string]>
				).map(([name, message]) => ({ name, errors: [message] }));

				if (fieldErrors.length > 0) {
					form.setFields(fieldErrors);
					form.scrollToField(fieldErrors[0].name);
				}

				// Only an unattributable sentence needs the banner; when every
				// segment landed on a field, the fields already explain the failure.
				setSaveState(
					parsed.unparsed !== null || fieldErrors.length === 0
						? { status: "error", message: CREATE_FORM_ERROR }
						: { status: "idle" },
				);
				return;
			}

			if (apiError?.status === 409) {
				const conflict = classifyCreateConflict(apiError.message);

				if (conflict.kind === "email") {
					form.setFields([{ name: "email", errors: [conflict.message] }]);
					form.scrollToField("email");
					setSaveState({ status: "idle" });
				} else {
					setSaveState({ status: "error", message: conflict.message });
				}

				return;
			}

			const failure = handleFailure(
				caught,
				"We couldn't create this user. Try again.",
			);

			setSaveState(
				failure.kind === "session-expired"
					? { status: "idle" }
					: { status: "error", message: failure.message },
			);
		}
	}

	// A direct URL must not offer a form that can only end in a 403. The backend
	// enforces the permission regardless; this keeps the user out of a dead end.
	if (!mayCreate) {
		return (
			<AdminTheme>
				<Result
					status="403"
					title="You can't add users"
					subTitle="Creating users needs the user:create permission. Ask an administrator to grant it to your role."
					extra={<Button href={LISTING_PATH}>Back to user accounts</Button>}
				/>
			</AdminTheme>
		);
	}

	return (
		<AdminTheme>
			<section className={styles.page}>
				<Link className={styles.back} href={LISTING_PATH}>
					<ArrowLeftOutlined aria-hidden="true" /> User accounts
				</Link>

				<header className={styles.header}>
					<Title level={1} className={styles.title}>
						Add user
					</Title>
					<Text type="secondary">
						Create an account for a staff member and choose what it can do.
					</Text>
					<Alert
						className={styles.notice}
						type="info"
						showIcon
						title="New accounts can sign in immediately. Share the password securely — the user can change it after signing in."
					/>
				</header>

				{saveState.status === "error" && (
					<Alert
						type="error"
						showIcon
						title="Couldn't create the user"
						description={saveState.message}
					/>
				)}

				<Form<UserCreateFormValues>
					form={form}
					layout="vertical"
					requiredMark
					initialValues={{ role: DEFAULT_ROLE }}
					scrollToFirstError={{ focus: true }}
					onFinish={(values) => void handleFinish(values)}
				>
					<div className={styles.columns}>
						<div className={styles.mainColumn}>
							<Card title="Personal information">
								<Form.Item
									name="name"
									label="Full name"
									required
									extra={`Up to ${USER_NAME_MAX_LENGTH} characters.`}
									rules={[
										{
											validator: async (_, value: string) => {
												const error = validateUserName(value ?? "");

												if (error) {
													throw new Error(error);
												}
											},
										},
									]}
								>
									<Input
										placeholder="e.g. Alice Nguyen"
										autoComplete="name"
										disabled={saving}
									/>
								</Form.Item>

								<Form.Item
									name="email"
									label="Email"
									required
									extra={`Used to sign in. Up to ${USER_EMAIL_MAX_LENGTH} characters.`}
									rules={[
										{
											validator: async (_, value: string) => {
												const error = validateUserEmail(value ?? "");

												if (error) {
													throw new Error(error);
												}
											},
										},
									]}
								>
									<Input
										type="email"
										placeholder="name@example.com"
										autoComplete="email"
										disabled={saving}
									/>
								</Form.Item>

								<Form.Item
									name="phone"
									label="Phone"
									required
									extra="10–15 digits. Spaces, dashes, dots, and parentheses are removed."
									rules={[
										{
											validator: async (_, value: string) => {
												const error = validateUserPhone(value ?? "");

												if (error) {
													throw new Error(error);
												}
											},
										},
									]}
								>
									<Input
										type="tel"
										inputMode="tel"
										placeholder="091 234 5678"
										autoComplete="tel"
										disabled={saving}
									/>
								</Form.Item>

								<Form.Item
									name="address"
									label="Address"
									extra={`Optional. Up to ${USER_ADDRESS_MAX_LENGTH} characters.`}
									rules={[
										{
											validator: async (_, value: string) => {
												const error = validateUserAddress(value ?? "");

												if (error) {
													throw new Error(error);
												}
											},
										},
									]}
								>
									<Input.TextArea
										rows={2}
										placeholder="Street, city, and any delivery notes."
										autoComplete="street-address"
										disabled={saving}
									/>
								</Form.Item>
							</Card>
						</div>

						<div className={styles.sideColumn}>
							<Card title="Role">
								<Form.Item
									name="role"
									label="Staff role"
									required
									extra={
										usingFallback
											? ROLE_FALLBACK_HINT
											: "Only staff roles can be assigned when creating an account."
									}
									rules={[{ required: true, message: "Choose a role." }]}
								>
									<Select
										showSearch={{ optionFilterProp: "label" }}
										placeholder="Choose a role"
										options={staffRoleOptions}
										loading={rolesLoading}
										disabled={saving || rolesLoading}
									/>
								</Form.Item>

								{usingFallback && (
									<Form.Item
										name="customRoleCode"
										label="Known role code"
										extra="Overrides the staff role when filled in."
										rules={[{ validator: validateKnownStaffRoleCode }]}
									>
										<Input
											placeholder="e.g. catalog_editor"
											autoComplete="off"
											disabled={saving}
										/>
									</Form.Item>
								)}
							</Card>

							<Card title="Password">
								<Form.Item
									name="password"
									label="Password"
									required
									extra={`At least ${PASSWORD_MIN_LENGTH} characters; at most ${PASSWORD_MAX_BYTES} UTF-8 bytes.`}
									rules={[
										{
											validator: async (_, value: string) => {
												const error = validateUserPassword(value ?? "");

												if (error) {
													throw new Error(error);
												}
											},
										},
									]}
								>
									<Input.Password
										autoComplete="new-password"
										disabled={saving}
									/>
								</Form.Item>

								<PasswordStrengthMeter value={password} />
							</Card>
						</div>
					</div>

					<footer className={styles.saveBar}>
						<Text type="secondary" className={styles.saveStatus} aria-live="polite">
							{saving
								? "Saving…"
								: saveState.status === "error"
									? "New user · Not saved — see the error above"
									: "New user · Not saved"}
						</Text>
						<Button href={LISTING_PATH} disabled={saving}>
							Cancel
						</Button>
						<Button type="primary" htmlType="submit" loading={saving}>
							Create user
						</Button>
					</footer>
				</Form>
			</section>
		</AdminTheme>
	);
}

/**
 * The password advice meter. It never blocks submission: the length/byte rule
 * is the field validator's job, while this tells the user how much stronger a
 * 12-character mixed password would be.
 */
function PasswordStrengthMeter({ value }: { value: string }) {
	const level = passwordStrength(value);
	const label = passwordStrengthLabel(level);

	return (
		<div className={styles.strength} data-level={level}>
			<div className={styles.strengthHeader}>
				<span>Password strength</span>
				<span className={styles.strengthLabel} data-level={level}>
					{value ? label : "—"}
				</span>
			</div>

			<div
				className={styles.strengthTrack}
				role="img"
				aria-label={`Password strength: ${label}`}
			>
				{[1, 2, 3, 4].map((step) => (
					<span
						key={step}
						className={[
							styles.strengthSegment,
							step <= level ? styles.strengthSegmentOn : "",
						]
							.filter(Boolean)
							.join(" ")}
					/>
				))}
			</div>

			<ul className={styles.checklist}>
				{passwordChecklist(value).map((check) => (
					<li
						key={check.key}
						className={check.met ? styles.checkMet : undefined}
					>
						{check.met ? (
							<CheckCircleFilled aria-hidden="true" />
						) : (
							<MinusCircleOutlined aria-hidden="true" />
						)}
						<span>{check.label}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
