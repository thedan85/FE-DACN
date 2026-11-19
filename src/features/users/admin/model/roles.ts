import type { Role, UserDetail } from "../schema/user.schema";

/**
 * The built-in staff roles, used when `GET admin/roles` cannot be read.
 *
 * That endpoint needs `role:read`, which is a different permission from the
 * user codes. An account that can manage users but not read roles would
 * otherwise get an empty role select and a screen it cannot finish using.
 * These two codes are the ones `docs/admin-users-api.md` names as always
 * supported, so they are a safe floor rather than an invention.
 */
export const FALLBACK_STAFF_ROLES: readonly Role[] = [
	{
		roleId: "employee",
		code: "employee",
		name: "Employee",
		description: null,
		system: true,
	},
	{
		roleId: "admin",
		code: "admin",
		name: "Administrator",
		description: null,
		system: true,
	},
];

/** Shown beside a fallback role select so the restriction is not silent. */
export const ROLE_FALLBACK_HINT =
	"Role list unavailable — showing the built-in staff roles.";

export const CUSTOMER_ROLE_CODE = "customer";

/** The roles the create and edit screens may assign: everything but customer. */
export function staffRoles(roles: readonly Role[]): Role[] {
	return roles.filter((role) => role.code.toLowerCase() !== CUSTOMER_ROLE_CODE);
}

/** Keep the account's exact value/label visible, even for non-assignable roles. */
export function editUserRoleOptions(
	roles: readonly Role[],
	current: Pick<UserDetail, "roleCode" | "roleName">,
) {
	const options = staffRoles(roles).map((role) => ({ value: role.code, label: role.name, disabled: false }));
	const index = options.findIndex((option) => option.value.toLowerCase() === current.roleCode.toLowerCase());
	const currentOption = { value: current.roleCode, label: current.roleName, disabled: index < 0 };
	if (index < 0) options.unshift(currentOption);
	else options[index] = currentOption;
	return options;
}

/** Filter links can reference a role unavailable in the caller's role catalog. */
export function userRoleFilterOptions(roles: readonly Role[], currentCode?: string) {
	const options = roles.map((role) => ({ value: role.code, label: role.name }));
	if (currentCode) {
		const index = options.findIndex((option) => option.value.toLowerCase() === currentCode.toLowerCase());
		if (index < 0) options.unshift({ value: currentCode, label: currentCode });
		else options[index] = { ...options[index], value: currentCode };
	}
	return [{ value: "", label: "All roles" }, ...options];
}

/**
 * The staff screen's filter options: the staff-assignable roles only, with no
 * "All roles" escape and the customer role excluded in every spelling. An
 * unknown current code stays visible so a shared link never renders a blank
 * select, unless it is the customer role, which staff mode never offers.
 */
export function staffRoleFilterOptions(roles: readonly Role[], currentCode?: string) {
	const options = staffRoles(roles).map((role) => ({ value: role.code, label: role.name }));
	const current = currentCode?.trim();

	if (current && current.toLowerCase() !== CUSTOMER_ROLE_CODE) {
		const index = options.findIndex((option) => option.value.toLowerCase() === current.toLowerCase());
		if (index < 0) options.unshift({ value: current, label: current });
		else options[index] = { ...options[index], value: current };
	}

	return options;
}
