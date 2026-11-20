import type { UserAccountStatus } from "../schema/user.schema";
import { normalizeRoleCode } from "./roles";

/** The fields the edit screen can change. */
export type UserEditFormValues = {
	role: string;
	/** A known role code, used when the role list cannot be read. */
	customRoleCode?: string;
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
	const role = normalizeRoleCode(values.customRoleCode ?? "") || normalizeRoleCode(values.role);

	if (role !== normalizeRoleCode(user.roleCode)) {
		changes.roleCode = role;
	}

	if (values.status !== user.status) {
		changes.status = values.status;
	}

	return changes;
}
