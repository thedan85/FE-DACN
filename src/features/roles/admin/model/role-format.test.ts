import { expect, it } from "vitest";
import { decodeRoleRouteParam, roleHref, roleName } from "./role-format";

it("decodes Next 16.4's encoded route param exactly once, not the id's own percent escapes", () => {
	expect(decodeRoleRouteParam("support%2Fopaque%25")).toBe("support/opaque%");
	expect(decodeRoleRouteParam("literal%252F-role")).toBe("literal%2F-role");
	expect(decodeRoleRouteParam("role-admin")).toBe("role-admin");
});
it("encodes opaque identifiers for links without deriving them from role codes", () => {
	expect(roleHref("support/opaque%")).toBe("/admin/roles/support%2Fopaque%25");
	expect(roleName({ name: null, code: "support" })).toBe("support");
});
