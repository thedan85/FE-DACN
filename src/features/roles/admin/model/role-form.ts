import type { CreateRoleInput, UpdateRoleInput } from "../api/roles.api";
import type { RoleSummary } from "../schema/role.schema";

export const ROLE_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{1,49}$/;
export type RoleInformationValues = { name: string; description: string };
export type RoleCreateValues = RoleInformationValues & { code: string };

export function validateRoleCode(value: string) {
	const code = value.trim();
	if (code.length > 50) return "Code must be 2–50 characters.";
	return ROLE_CODE_PATTERN.test(code) ? null : "Use 2–50 letters, digits or underscores, starting with a letter.";
}
export function validateRoleName(value: string, unchangedName?: string | null) {
	// A legacy missing name need not be PATCHed to change independent permissions
	// or a description. Creation and an actual change to blank still fail below.
	if (unchangedName !== undefined && value === (unchangedName ?? "") && !value.trim()) return null;
	return !value.trim() ? "Enter the role name." : value.length > 255 ? "Use at most 255 characters." : null;
}
export function validateRoleDescription(value: string) {
	return value.length > 2000 ? "Use at most 2000 characters." : null;
}
export function toCreateRoleInput(values: RoleCreateValues): CreateRoleInput {
	return { code: values.code.trim(), name: values.name.trim(), ...(values.description?.trim() ? { description: values.description.trim() } : {}) };
}
export function roleInformationPatch(role: RoleSummary, values: RoleInformationValues): UpdateRoleInput {
	const patch: UpdateRoleInput = {};
	if (values.name.trim() !== (role.name?.trim() ?? "")) patch.name = values.name.trim();
	if ((values.description?.trim() ?? "") !== (role.description?.trim() ?? "")) patch.description = values.description?.trim() ?? "";
	return patch;
}
