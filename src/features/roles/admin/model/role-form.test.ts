import { expect, it } from "vitest";
import { roleDetailFixture } from "../test-fixtures";
import { roleInformationPatch, toCreateRoleInput, validateRoleCode, validateRoleName, validateRoleDescription } from "./role-form";

it("maps only changed PATCH fields and uses blank text to clear a description", () => {
	expect(roleInformationPatch(roleDetailFixture, { name: " Support ", description: "" })).toEqual({});
	expect(roleInformationPatch({ ...roleDetailFixture, description: "Old" }, { name: "Support Desk", description: " " })).toEqual({ name: "Support Desk", description: "" });
});
it("does not include immutable code/system or permission codes in create/info requests", () => {
	expect(toCreateRoleInput({ code: " Auditor_NEW ", name: " Auditor ", description: " " })).toEqual({ code: "Auditor_NEW", name: "Auditor" });
});
it.each(["a", "1role", "bad-code", "a".repeat(51), ""])("rejects code %s", (code) => { expect(validateRoleCode(code)).not.toBeNull(); });
it("enforces name/description limits without requiring a description", () => {
	expect(validateRoleCode("Auditor_NEW")).toBeNull();
	expect(validateRoleName(" ")).not.toBeNull();
	expect(validateRoleName("a".repeat(256))).not.toBeNull();
	expect(validateRoleDescription("a".repeat(2001))).not.toBeNull();
	expect(validateRoleDescription("")).toBeNull();
});

it("allows an unchanged legacy null name but never a new blank name", () => {
	expect(validateRoleName("", null)).toBeNull();
	expect(validateRoleName("", "")).toBeNull();
	expect(validateRoleName("", "Existing")).not.toBeNull();
	expect(validateRoleName(" ", null)).not.toBeNull();
	expect(validateRoleName("")).not.toBeNull();
});

it("reports an over-length code separately from invalid syntax", () => {
	expect(validateRoleCode("a".repeat(50))).toBeNull();
	expect(validateRoleCode("a".repeat(51))).toBe("Code must be 2–50 characters.");
	expect(validateRoleCode("bad-code")).toBe("Use 2–50 letters, digits or underscores, starting with a letter.");
});
