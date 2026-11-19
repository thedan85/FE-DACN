import { describe, expect, it } from "vitest";

import {
	USER_ADDRESS_MAX_LENGTH,
	USER_EMAIL_MAX_LENGTH,
	USER_NAME_MAX_LENGTH,
	passwordChecklist,
	passwordStrength,
	passwordStrengthLabel,
	toCreateAdminUserInput,
	validateUserAddress,
	validateUserEmail,
	validateUserName,
	validateUserPassword,
	validateUserPhone,
} from "./user-create-form";

describe("validateUserName", () => {
	it("requires a non-blank name", () => {
		expect(validateUserName("   ")).toBe("Enter the user's full name.");
	});

	it("accepts a name at the maximum length", () => {
		expect(validateUserName("a".repeat(USER_NAME_MAX_LENGTH))).toBeNull();
	});

	it("rejects a name past the maximum length", () => {
		expect(validateUserName("a".repeat(USER_NAME_MAX_LENGTH + 1))).toBe(
			`Name must be ${USER_NAME_MAX_LENGTH} characters or fewer.`,
		);
	});
});

describe("validateUserEmail", () => {
	it("requires an email address", () => {
		expect(validateUserEmail(" ")).toBe("Enter the user's email address.");
	});

	it("rejects a malformed address", () => {
		expect(validateUserEmail("not-an-email")).toBe(
			"Enter a valid email address, e.g. name@example.com.",
		);
	});

	it("rejects an address past the maximum length", () => {
		const longEmail = `${"a".repeat(USER_EMAIL_MAX_LENGTH)}@example.com`;

		expect(validateUserEmail(longEmail)).toBe(
			`Email must be ${USER_EMAIL_MAX_LENGTH} characters or fewer.`,
		);
	});

	it("accepts a normal address", () => {
		expect(validateUserEmail("alice@example.com")).toBeNull();
	});
});

describe("validateUserPhone", () => {
	it("accepts a formatted phone number", () => {
		expect(validateUserPhone("(091) 234-5678")).toBeNull();
	});

	it("rejects a value that is not a phone number", () => {
		expect(validateUserPhone("12345")).toBe(
			"Enter 10–15 digits, with an optional leading +.",
		);
	});
});

describe("validateUserPassword", () => {
	it("requires a password", () => {
		expect(validateUserPassword("")).toBe("Set a password for this user.");
	});

	it("rejects a password below the hard minimum", () => {
		expect(validateUserPassword("a".repeat(7))).toBe(
			"Password must be 8–72 bytes (about 72 characters, fewer if it has accented or non-Latin characters).",
		);
	});

	it.each(["a".repeat(8), "a".repeat(72), "é".repeat(36), "界".repeat(24), "😀".repeat(18)])("accepts a password within both limits: %s", (value) => {
		expect(validateUserPassword(value)).toBeNull();
	});

	it.each(["a".repeat(73), "é".repeat(37), "界".repeat(25), "😀".repeat(19), "é".repeat(7)])("rejects passwords over 72 UTF-8 bytes or below 8 characters: %s", (value) => {
		expect(validateUserPassword(value)).toBe(
			"Password must be 8–72 bytes (about 72 characters, fewer if it has accented or non-Latin characters).",
		);
	});
});

describe("validateUserAddress", () => {
	it("treats the optional address as valid when blank", () => {
		expect(validateUserAddress("")).toBeNull();
	});

	it("rejects an address past the maximum length", () => {
		expect(validateUserAddress("a".repeat(USER_ADDRESS_MAX_LENGTH + 1))).toBe(
			`Address must be ${USER_ADDRESS_MAX_LENGTH} characters or fewer.`,
		);
	});
});

describe("password advice", () => {
	it("marks each recommendation independently", () => {
		const checks = passwordChecklist("Abcdefghijk1!");

		expect(checks.every((check) => check.met)).toBe(true);
	});

	it("reports nothing met for an empty value", () => {
		expect(passwordChecklist("").some((check) => check.met)).toBe(false);
	});

	it("scores below the hard minimum as too short", () => {
		expect(passwordStrength("Ab1!")).toBe(0);
		expect(passwordStrengthLabel(0)).toBe("Too short");
	});

	it("scores a long password with a varied character set as strong", () => {
		expect(passwordStrength("Abcdefghijk1!")).toBe(4);
		expect(passwordStrengthLabel(4)).toBe("Strong");
	});

	it("caps a short but varied password below strong", () => {
		expect(passwordStrength("Abcdefg1!")).toBe(3);
		expect(passwordStrengthLabel(3)).toBe("Good");
	});
});

describe("toCreateAdminUserInput", () => {
	it("trims text fields, normalises the phone, and maps role to roleCode", () => {
		expect(
			toCreateAdminUserInput({
				name: "  Alice User  ",
				email: "  Alice@Example.com  ",
				phone: " (091) 234-5678 ",
				address: "  12 Example Street  ",
				role: "employee",
				password: "correct horse battery",
			}),
		).toEqual({
			name: "Alice User",
			email: "Alice@Example.com",
			phone: "0912345678",
			address: "12 Example Street",
			roleCode: "employee",
			password: "correct horse battery",
		});
	});

	it("omits a blank address rather than sending an empty string", () => {
		const input = toCreateAdminUserInput({
			name: "Alice User",
			email: "alice@example.com",
			phone: "0912345678",
			address: "   ",
			role: "admin",
			password: "correct horse battery",
		});

		expect(input.address).toBeUndefined();
	});
});
