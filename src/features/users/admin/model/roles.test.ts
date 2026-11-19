import { expect, it } from "vitest";
import type { Role } from "../schema/user.schema";
import { editUserRoleOptions, userRoleFilterOptions } from "./roles";

const roles: Role[] = [
	{ roleId: "role-employee", code: "employee", name: "Employee from list", description: null, system: true },
	{ roleId: "role-admin", code: "admin", name: "Administrator", description: null, system: true },
	{ roleId: "role-customer", code: "customer", name: "Customer", description: null, system: true },
];

it("uses the account's current-role label even when the catalog label differs", () => {
	const options = editUserRoleOptions(roles, { roleCode: "employee", roleName: "Employee from account" });
	expect(options).toEqual([
		{ value: "employee", label: "Employee from account", disabled: false },
		{ value: "admin", label: "Administrator", disabled: false },
	]);
});

it.each([
	{ roleCode: "customer", roleName: "Customer account" },
	{ roleCode: "archived_custom", roleName: "Old custom role" },
])("displays non-assignable $roleCode but disables it as a choice", (current) => {
	const options = editUserRoleOptions(roles, current);
	expect(options[0]).toEqual({ value: current.roleCode, label: current.roleName, disabled: true });
	expect(options.filter((option) => !option.disabled).map((option) => option.value)).toEqual(["employee", "admin"]);
});

it("matches role codes case-insensitively without rewriting the form's initial value", () => {
	const options = editUserRoleOptions(roles, { roleCode: "EMPLOYEE", roleName: "Current employee" });
	expect(options[0]).toEqual({ value: "EMPLOYEE", label: "Current employee", disabled: false });
	expect(options).toHaveLength(2);
});

it("keeps a selected filter represented even when its role is not in the fetched list", () => {
	expect(userRoleFilterOptions([], "custom_missing")).toEqual([
		{ value: "", label: "All roles" },
		{ value: "custom_missing", label: "custom_missing" },
	]);
	expect(userRoleFilterOptions(roles, "EMPLOYEE")[1]).toEqual({ value: "EMPLOYEE", label: "Employee from list" });
});
