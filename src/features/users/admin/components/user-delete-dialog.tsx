"use client";

import { useState } from "react";
import { App } from "antd";

import { ApiError } from "@/lib/api/client";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";

import { deleteAdminUser } from "../api/users.api";
import { normalizeUserConflict } from "../model/user-api-error";
import { displayName } from "../model/user-format";
import { useUserApiFailure } from "../model/use-user-api-failure";
import type { UserSummary } from "../schema/user.schema";
import { UserAvatar } from "./user-avatar";
import styles from "./user-delete-dialog.module.css";

type UserDeleteDialogProps = {
	/** The row to delete, or `null` when the dialog is closed. */
	user: UserSummary | null;
	onClose: () => void;
	/** Called after the account is gone, so the caller can leave or refresh. */
	onDeleted: (user: UserSummary) => void;
};

/**
 * The one delete confirmation for both the listing and the detail screen.
 *
 * Soft delete is not obvious from a trash icon, so the dialog says what
 * actually happens: access ends, order history stays, and the email remains
 * reserved. The backend still enforces the self-delete and last-admin rules;
 * the copy is guidance, not the safety mechanism.
 *
 * `deleting` is a hard guard, not just the button's spinner: two clicks before
 * the first request resolves would otherwise send two DELETEs.
 */
export function UserDeleteDialog({
	user: target,
	onClose,
	onDeleted,
}: UserDeleteDialogProps) {
	const { notification } = App.useApp();
	const handleFailure = useUserApiFailure();
	const [deleting, setDeleting] = useState(false);

	async function confirmDelete() {
		if (target === null || deleting) {
			return;
		}

		setDeleting(true);

		try {
			await deleteAdminUser(target.userId);

			notification.success({
				title: "User deleted",
				description: `${displayName(target)} can no longer sign in.`,
			});
			setDeleting(false);
			onDeleted(target);
			onClose();
		} catch (caught) {
			const failure = handleFailure(
				caught,
				"We couldn't delete this user. Try again.",
			);

			if (failure.kind !== "session-expired") {
				const message =
					caught instanceof ApiError && caught.status === 409
						? normalizeUserConflict(caught.message)
						: failure.message;

				notification.error({
					title: "Could not delete user",
					description: message,
				});
			}

			setDeleting(false);

			// The row is already gone server-side; keeping the dialog open would
			// only invite a second failing attempt.
			if (caught instanceof ApiError && caught.status === 404) {
				onDeleted(target);
				onClose();
			}
		}
	}

	return (
		<ConfirmDialog
			open={target !== null}
			title="Delete user?"
			confirmText="Delete user"
			cancelText="Keep user"
			confirmLoading={deleting}
			danger
			onCancel={() => {
				if (!deleting) {
					onClose();
				}
			}}
			onConfirm={confirmDelete}
			description={
				target !== null ? (
					<div className={styles.body}>
						<div className={styles.user}>
							<UserAvatar name={target.name} email={target.email} />
							<div className={styles.identity}>
								<span className={styles.name}>{displayName(target)}</span>
								<span className={styles.email}>{target.email}</span>
							</div>
						</div>
						<p className={styles.copy}>
							This removes their access to the admin portal. Their order
							history is kept. Their email cannot be reused for a new
							account.
						</p>
					</div>
				) : null
			}
		/>
	);
}
