import { expect, it } from "vitest";

import { UserDetailSchema, UserPageSchema, UserSummarySchema } from "./user.schema";

const nullNameUser = {
	userId: "USR_missing-profile",
	email: "missing.profile@example.com",
	name: null,
	phone: null,
	roleCode: "employee",
	roleName: "Employee",
	status: "ACTIVE",
	lastLogin: null,
	createdAt: "2026-10-12T00:00:00.000Z",
};

const emptyNameUser = {
	...nullNameUser,
	userId: "USR_empty-profile",
	email: "empty.profile@example.com",
	name: "",
};

it("keeps a list page readable when profile names are null or empty", () => {
	const page = {
		content: [nullNameUser, emptyNameUser],
		page: 0,
		size: 20,
		totalElements: 2,
		totalPages: 1,
	};

	expect(UserPageSchema.parse(page)).toEqual(page);
});

it.each([nullNameUser, emptyNameUser])(
	"accepts the summary for $userId without inventing profile data",
	(user) => {
		expect(UserSummarySchema.parse(user)).toEqual(user);
	},
);

it.each([nullNameUser, emptyNameUser])(
	"accepts the detail for $userId while keeping other profile fields nullable",
	(user) => {
		const detail = { ...user, address: null, permissions: ["user:read"] };

		expect(UserDetailSchema.parse(detail)).toEqual(detail);
	},
);

it("still rejects invalid name types and an omitted name", () => {
	expect(UserSummarySchema.safeParse({ ...nullNameUser, name: 123 }).success).toBe(false);
	expect(UserSummarySchema.safeParse({ ...nullNameUser, name: undefined }).success).toBe(false);
});
