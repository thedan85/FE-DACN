"use client";

import { useState } from "react";
import { App } from "antd";

import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ApiError } from "@/lib/api/client";

import { deleteAdminUser } from "../api/users.api";
import { normalizeUserConflict } from "../model/user-api-error";
import { displayName } from "../model/user-format";
import { useUserApiFailure } from "../model/use-user-api-failure";
import type { UserSummary } from "../schema/user.schema";
import styles from "./users-bulk-delete-dialog.module.css";

type UsersBulkDeleteDialogProps = {
	/** The current page's selected rows; empty when the dialog is closed. */
	users: UserSummary[];
	onClose: () => void;
	/** Called after the loop, with how many rows are gone, so the caller refreshes. */
	onCompleted: (deletedCount: number) => void;
};

type Failure = { name: string; message: string };

/**
 * One confirmation for deleting the current page's selection.
 *
 * The loop is sequential rather than `Promise.all`: the backend applies its
 * last-admin and self-delete rules per row, and a serial run keeps the failures
 * attributable to the row that caused them. Every failure is collected into one
 * summary notification instead of a toast per row.
 */
export function UsersBulkDeleteDialog({
	users,
	onClose,
	onCompleted,
}: UsersBulkDeleteDialogProps) {
	const { notification } = App.useApp();
	const handleFailure = useUserApiFailure();
	const [deleting, setDeleting] = useState(false);

	const count = users.length;

	async function confirmDelete() {
		if (deleting || count === 0) {
			return;
		}

		setDeleting(true);

		const failures: Failure[] = [];
		let deleted = 0;

		for (const user of users) {
			try {
				await deleteAdminUser(user.userId);
				deleted += 1;
			} catch (caught) {
				// Already gone is the outcome the caller wanted, not a failure.
				if (caught instanceof ApiError && caught.status === 404) {
					deleted += 1;
					continue;
				}

				const failure = handleFailure(
					caught,
					"We couldn't delete this user. Try again.",
				);

				if (failure.kind === "session-expired") {
					setDeleting(false);
					onClose();
					return;
				}

				failures.push({
					name: displayName(user),
					message:
						caught instanceof ApiError && caught.status === 409
							? normalizeUserConflict(caught.message)
							: failure.message,
				});
			}
		}

		setDeleting(false);

		if (failures.length === 0) {
			notification.success({
				title: deleted === 1 ? "User deleted" : "Users deleted",
				description: `${deleted} ${
					deleted === 1 ? "account" : "accounts"
				} can no longer sign in.`,
			});
		} else {
			notification.error({
				title: "Some users weren't deleted",
				description: (
					<div>
						<p className={styles.summary}>
							{deleted} of {count} deleted.
						</p>
						<ul className={styles.failures}>
							{failures.map((failure, index) => (
								<li key={`${failure.name}-${index}`}>
									<strong>{failure.name}</strong>: {failure.message}
								</li>
							))}
						</ul>
					</div>
				),
			});
		}

		onCompleted(deleted);
		onClose();
	}

	return (
		<ConfirmDialog
			open={count > 0}
			title={`Delete ${count} ${count === 1 ? "user" : "users"}?`}
			confirmText={count === 1 ? "Delete user" : "Delete users"}
			cancelText={count === 1 ? "Keep user" : "Keep users"}
			confirmLoading={deleting}
			danger
			onCancel={() => {
				if (!deleting) {
					onClose();
				}
			}}
			onConfirm={confirmDelete}
			description={
				<div className={styles.body}>
					<p className={styles.copy}>
						{count === 1
							? "This account will lose access to the admin portal."
							: `These ${count} accounts will lose access to the admin portal.`}{" "}
						Order history is kept, and the email addresses cannot be reused
						for new accounts.
					</p>
				</div>
			}
		/>
	);
}
