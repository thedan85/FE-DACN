import { expect, it } from "vitest";
import { roleFixture, permissionFixture } from "../test-fixtures";
import { RoleSummarySchema, RoleDetailSchema, PermissionSchema } from "./role.schema";

it("accepts the seeded role-admin id and null description", () => {
	expect(RoleSummarySchema.parse(roleFixture)).toEqual(roleFixture);
});

it("tolerates null display fields and unknown future resource/actions", () => {
	const permission = { ...permissionFixture, name: null, resource: "future-resource", action: "future-action" };
	expect(PermissionSchema.parse(permission)).toEqual(permission);
	expect(RoleDetailSchema.parse({ ...roleFixture, name: null, updatedAt: null, permissions: [permission], extra: true }).name).toBeNull();
});

it("rejects missing structural identifiers but ignores additional response fields", () => {
	expect(PermissionSchema.safeParse({ ...permissionFixture, permissionId: null }).success).toBe(false);
	expect(RoleSummarySchema.parse({ ...roleFixture, future: "value" })).toEqual(roleFixture);
});
