import type { Permission, RoleSummary } from "../schema/role.schema";

export function groupPermissions(permissions: readonly Permission[]) {
	const groups = new Map<string, Permission[]>();
	for (const permission of permissions) {
		const resource = permission.resource?.trim() || "Other";
		groups.set(resource, [...(groups.get(resource) ?? []), permission]);
	}
	return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([resource, items]) => ({
		resource, permissions: [...items].sort((a, b) => a.code.localeCompare(b.code)),
	}));
}

export function selectionDiff(before: readonly string[], after: readonly string[]) {
	const old = new Set(before);
	const next = new Set(after);
	return { added: [...next].filter((id) => !old.has(id)), removed: [...old].filter((id) => !next.has(id)) };
}

export function adminLockedIds(role: Pick<RoleSummary, "code">, permissions: readonly Permission[]) {
	return new Set(role.code === "admin" ? permissions.filter((permission) =>
		permission.resource === "user" || permission.resource === "role" || /^(user|role):/.test(permission.code),
	).map((permission) => permission.permissionId) : []);
}

export function effectiveSelection(selected: readonly string[], locked: ReadonlySet<string>) {
	return [...new Set([...selected, ...locked])];
}

export function toggleGroup(selected: readonly string[], groupIds: readonly string[], locked: ReadonlySet<string>) {
	const allSelected = groupIds.every((id) => selected.includes(id));
	return effectiveSelection(allSelected ? selected.filter((id) => !groupIds.includes(id) || locked.has(id)) : [...selected, ...groupIds], locked);
}
