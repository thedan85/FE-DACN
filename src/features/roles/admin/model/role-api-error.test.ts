import { expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { roleFormFailure, isPermissionNotFound } from "./role-api-error";

it("splits create 400s onto known fields and keeps unparsed text in an alert", () => {
	expect(roleFormFailure(new ApiError("code: invalid; name: required; Unexpected rule", 400), "create")).toEqual({ fields: [{ name: "code", errors: ["invalid"] }, { name: "name", errors: ["required"] }], alert: "Unexpected rule" });
});
it("puts create 409 on code, including soft-deleted codes", () => {
	expect(roleFormFailure(new ApiError("Role code already exists", 409), "create")).toEqual({ fields: [{ name: "code", errors: ["Role code already exists"] }], alert: null });
});
it("maps a blank PATCH name error and distinguishes missing permissions from missing roles", () => {
	expect(roleFormFailure(new ApiError("name must not be blank", 400), "update").fields).toEqual([{ name: "name", errors: ["name must not be blank"] }]);
	expect(isPermissionNotFound(new ApiError("permission not found: arbitrary-id", 404))).toBe(true);
	expect(isPermissionNotFound(new ApiError("role not found: arbitrary-id", 404))).toBe(false);
	expect(isPermissionNotFound(new ApiError("role not found: ROLE_permissions-manager", 404))).toBe(false);
});
