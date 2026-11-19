import type { RoleSummary } from "../schema/role.schema";

export const ROLES_PATH = "/admin/roles";
export function roleName(role: Pick<RoleSummary, "name" | "code">) {
	return role.name?.trim() || role.code;
}
export function roleHref(roleId: string) {
	return `${ROLES_PATH}/${encodeURIComponent(roleId)}`;
}
/**
 * Next 16.4.3's get-dynamic-param.js encodes the value passed to page code.
 * Decode that URL transport layer once here; never decode API ids themselves.
 */
export function decodeRoleRouteParam(segment: string) {
	return decodeURIComponent(segment);
}
export function roleUsersHref(code: string) {
	return `/admin/users?${new URLSearchParams({ roleCode: code })}`;
}
