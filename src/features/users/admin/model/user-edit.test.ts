import { describe, expect, it } from "vitest";

import { userEditChanges } from "./user-edit";

const user = { roleCode: "employee", status: "ACTIVE" as const };

describe("userEditChanges", () => {
	it("returns nothing when neither field changed", () => {
		expect(
			userEditChanges(user, { role: "employee", status: "ACTIVE" }),
		).toEqual({});
	});

	it("returns only the role when the role changed", () => {
		expect(
			userEditChanges(user, { role: "admin", status: "ACTIVE" }),
		).toEqual({ roleCode: "admin" });
	});

	it("returns only the status when the status changed", () => {
		expect(
			userEditChanges(user, { role: "employee", status: "LOCKED" }),
		).toEqual({ status: "LOCKED" });
	});

	it("returns both fields when both changed", () => {
		expect(
			userEditChanges(
				{ roleCode: "customer", status: "LOCKED" },
				{ role: "admin", status: "ACTIVE" },
			),
		).toEqual({ roleCode: "admin", status: "ACTIVE" });
	});
});
