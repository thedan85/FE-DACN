"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	Alert,
	App,
	Button,
	Card,
	Descriptions,
	Form,
	Input,
	Segmented,
	Select,
	Typography,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

import { AdminTheme } from "@/components/layout/admin-theme";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

import {
	setAdminUserRole,
	setAdminUserStatus,
} from "../api/users.api";
import { CUSTOMER_ROLE_CODE, ROLE_FALLBACK_HINT, editUserRoleOptions, validateKnownStaffRoleCode } from "../model/roles";
import {
	normalizeUserConflict,
} from "../model/user-api-error";
import { userEditChanges, type UserEditFormValues } from "../model/user-edit";
import { displayName, formatUserDate } from "../model/user-format";
import { useUserApiFailure } from "../model/use-user-api-failure";
import type { UserAccountStatus, UserDetail } from "../schema/user.schema";
import { useAdminRoles } from "../use-admin-roles";
import styles from "./user-edit-screen.module.css";

const { Title, Text } = Typography;

/** Where the sidebar's "User accounts" item points. */
const LISTING_PATH = "/admin/users";

const STATUS_OPTIONS: Array<{ value: UserAccountStatus; label: string }> = [
	{ value: "ACTIVE", label: "Active" },
	{ value: "LOCKED", label: "Locked" },
];

type UserEditFormProps = {
	initialUser: UserDetail;
};

/**
 * Edit an account's access: its role and its status.
 *
 * The profile fields are read-only here. The API has no profile-update
 * endpoint, and the password is deliberately the user's own to change — a
 * screen that pretended otherwise would collect values the backend would
 * discard.
 *
 * Role and status are two separate PATCH endpoints, so only the changed fields
 * are sent, role first. If the role succeeds and the status fails, the local
 * account is refreshed from the role response: the form then shows what is
 * actually saved, and only the failed field remains dirty for a retry.
 */
export function UserEditForm({ initialUser }: UserEditFormProps) {
	const router = useRouter();
	const { message, notification } = App.useApp();
	const signedInUserId = useAuthStore((state) => state.user?.userId);
	const handleFailure = useUserApiFailure();
	const { roles, loading: rolesLoading, usingFallback } = useAdminRoles();

	const [form] = Form.useForm<UserEditFormValues>();
	/**
	 * The live role and status. They come from the form itself rather than a
	 * mirrored copy, so the dirty indicator and the helper copy always agree
	 * with what Save would send.
	 */
	const watched = Form.useWatch([], form) as
		| Partial<UserEditFormValues>
		| undefined;
	const [user, setUser] = useState(initialUser);
	const [saving, setSaving] = useState(false);
	const detailHref = `${LISTING_PATH}/${encodeURIComponent(user.userId)}`;
	const isSelf = user.userId === signedInUserId;
	const isCustomer = user.roleCode.toLowerCase() === CUSTOMER_ROLE_CODE;
	// Without role:read the built-in pair and a known role code still allow a
	// staff role change; the fallback must not lock the field.
	const roleLocked = isSelf || isCustomer;
	const statusLocked = isSelf;

	const roleOptions = editUserRoleOptions(roles, user);

	const currentValues: UserEditFormValues = {
		role: watched?.role ?? user.roleCode,
		customRoleCode: watched?.customRoleCode ?? "",
		status: watched?.status ?? user.status,
	};
	const changes = userEditChanges(user, currentValues);
	const dirty = Object.keys(changes).length > 0;

	const roleHint = isSelf
		? "You can't change your own role."
		: isCustomer
			? "Customer accounts can't be reassigned to a staff role."
			: usingFallback
				? ROLE_FALLBACK_HINT
				: "Changing the role changes which permissions this account has.";

	const statusHint = isSelf
		? "You can't lock your own account."
		: currentValues.status === "LOCKED"
			? "Signing in is blocked, and existing sessions are ended."
			: "The user can sign in and use the admin portal.";

	async function handleFinish(values: UserEditFormValues) {
		if (saving) {
			return;
		}

		const pending = userEditChanges(user, values);

		if (Object.keys(pending).length === 0) {
			message.info("There are no changes to save.");
			return;
		}

		setSaving(true);

		let latest = user;
		const saved: string[] = [];

		try {
			if (pending.roleCode !== undefined) {
				latest = await setAdminUserRole(latest.userId, pending.roleCode);
				saved.push("role");
				setUser(latest);
			}

			if (pending.status !== undefined) {
				latest = await setAdminUserStatus(latest.userId, pending.status);
				saved.push("status");
				setUser(latest);
			}

			setSaving(false);
			notification.success({
				title: "User updated successfully",
				description:
					saved.length === 2
						? "The role and status were updated."
						: saved[0] === "role"
							? "The role was updated."
							: "The status was updated.",
			});
			router.push(detailHref);
		} catch (caught) {
			const failure = handleFailure(
				caught,
				"We couldn't update this user. Try again.",
			);

			setSaving(false);

			if (failure.kind === "session-expired") {
				return;
			}

			const failureMessage =
				caught instanceof ApiError && caught.status === 409
					? normalizeUserConflict(caught.message)
					: failure.message;

			if (saved.length > 0) {
				notification.error({
					title: "User partially updated",
					description: `The ${saved.join(" and ")} ${
						saved.length === 1 ? "was" : "were"
					} updated, but the rest wasn't. ${failureMessage}`,
				});
			} else {
				notification.error({
					title: "Could not update user",
					description: failureMessage,
				});
			}
		}
	}

	return (
		<AdminTheme>
			<section className={styles.page}>
				<Link className={styles.back} href={LISTING_PATH}>
					<ArrowLeftOutlined aria-hidden="true" /> User accounts
				</Link>

				<header className={styles.header}>
					<Title level={1} className={styles.title}>
						Edit user
					</Title>
					<Text type="secondary" className={styles.subtitle}>
						{displayName(user)} · {user.email}
					</Text>
					<Text type="secondary">
						Member since {formatUserDate(user.createdAt)}
					</Text>
				</header>

				{isSelf && (
					<Alert
						type="info"
						showIcon
						title="You can't change your own role or lock your own account."
					/>
				)}

				<Form<UserEditFormValues>
					form={form}
					layout="vertical"
					requiredMark={false}
					// This component owns the store and mounts only with loaded data.
					// Do not clear it in Form effect cleanup: StrictMode replays that
					// cleanup during mount. A different account gets a fresh component.
					initialValues={{
						role: initialUser.roleCode,
						customRoleCode: "",
						status: initialUser.status,
					}}
					onFinish={(values) => void handleFinish(values)}
				>
					<div className={styles.columns}>
						<div className={styles.mainColumn}>
							<Card title="Profile" className={styles.card}>
								<Descriptions
									column={1}
									colon={false}
									items={[
										{ key: "name", label: "Full name", children: displayName(user) },
										{ key: "email", label: "Email", children: user.email },
										{
											key: "phone",
											label: "Phone",
											children: user.phone ?? "—",
										},
										{
											key: "address",
											label: "Address",
											children: user.address ?? "Not provided",
										},
									]}
								/>
								<Text type="secondary" className={styles.passwordNote}>
									Password changes are managed by the user.
								</Text>
							</Card>
						</div>

						<div className={styles.sideColumn}>
							<Card title="Access">
								<Form.Item
									name="role"
									label="Role"
									extra={roleHint}
								>
									<Select
										showSearch={{ optionFilterProp: "label" }}
										options={roleOptions}
										loading={rolesLoading}
										disabled={saving || rolesLoading || roleLocked}
									/>
								</Form.Item>

								{usingFallback && !roleLocked && (
									<Form.Item
										name="customRoleCode"
										label="Known role code"
										extra="Overrides the role select when filled in."
										rules={[{ validator: validateKnownStaffRoleCode }]}
									>
										<Input
											placeholder="e.g. catalog_editor"
											autoComplete="off"
											disabled={saving}
										/>
									</Form.Item>
								)}

								{/* A Segmented is a radiogroup, not a labelable control, so
								    the group carries its own accessible name. */}
								<Form.Item name="status" label="Status" extra={statusHint}>
									<Segmented<UserAccountStatus>
										block
										aria-label="Status"
										options={STATUS_OPTIONS}
										disabled={saving || statusLocked}
									/>
								</Form.Item>
							</Card>
						</div>
					</div>

					<footer className={styles.saveBar}>
						<Text type="secondary" className={styles.saveStatus} aria-live="polite">
							{saving ? "Saving…" : dirty ? "Unsaved changes" : "No changes to save"}
						</Text>
						<Button href={detailHref} disabled={saving}>
							Cancel
						</Button>
						<Button
							type="primary"
							htmlType="submit"
							loading={saving}
							disabled={!dirty}
						>
							Save changes
						</Button>
					</footer>
				</Form>
			</section>
		</AdminTheme>
	);
}
