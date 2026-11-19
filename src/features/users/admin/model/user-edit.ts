import type { UserAccountStatus } from "../schema/user.schema";

/** The two fields the edit screen can change. */
export type UserEditFormValues = {
	role: string;
	status: UserAccountStatus;
};

export type UserEditChanges = {
	roleCode?: string;
	status?: UserAccountStatus;
};

/**
 * The diff between the account as loaded and the form's values.
 *
 * Only changed fields are sent, and the role is sent before the status: the
 * two are separate PATCH endpoints, and changing a role can change which
 * permissions the account has. An empty object means the form is clean.
 */
export function userEditChanges(
	user: { roleCode: string; status: UserAccountStatus },
	values: UserEditFormValues,
): UserEditChanges {
	const changes: UserEditChanges = {};

	if (values.role !== user.roleCode) {
		changes.roleCode = values.role;
	}

	if (values.status !== user.status) {
		changes.status = values.status;
	}

	return changes;
}
