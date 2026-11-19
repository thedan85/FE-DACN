import { expect, it } from "vitest";

import {
	displayName,
	formatLastLogin,
	formatUserDate,
	userInitials,
} from "./user-format";

it("formats a timestamp the design's way, in UTC", () => {
	expect(formatUserDate("2026-10-12T00:00:00.000Z")).toBe("Oct 12, 2026");
	// Late-evening UTC stays the same calendar day regardless of the machine's
	// timezone, so the server and client render identical text.
	expect(formatUserDate("2026-10-12T23:30:00.000Z")).toBe("Oct 12, 2026");
});

it("renders a placeholder for a missing or invalid date", () => {
	expect(formatUserDate(null)).toBe("—");
	expect(formatUserDate(undefined)).toBe("—");
	expect(formatUserDate("")).toBe("—");
	expect(formatUserDate("not a date")).toBe("—");
});

it("says Never when the account has not signed in", () => {
	expect(formatLastLogin(null)).toBe("Never");
	expect(formatLastLogin("2026-01-05T00:00:00.000Z")).toBe("Jan 5, 2026");
});

it("takes two initials from a name", () => {
	expect(userInitials("Nguyen Van A", "a@test.com")).toBe("NV");
	expect(userInitials("Alice", "alice@test.com")).toBe("AL");
});

it("falls back to the email, then to a question mark", () => {
	expect(userInitials("   ", "bob@test.com")).toBe("B");
	expect(userInitials("", "bob@test.com")).toBe("B");
	expect(userInitials("", "")).toBe("?");
});

it("handles a null name without crashing the initials avatar", () => {
	expect(userInitials(null, "missing.profile@example.com")).toBe("M");
	expect(userInitials(null, "")).toBe("?");
});

it.each([
	{ name: "  Alice User  ", email: "alice@test.com", expected: "Alice User" },
	{ name: null, email: "missing.profile@example.com", expected: "missing.profile" },
	{ name: "", email: "empty.profile@example.com", expected: "empty.profile" },
	{ name: " \t ", email: "bob@test.com", expected: "bob" },
	{ name: null, email: "@example.com", expected: "@example.com" },
	{ name: "", email: "email-without-at", expected: "email-without-at" },
	{ name: null, email: "", expected: "" },
])("displays $expected for name=$name and email=$email", ({ name, email, expected }) => {
	expect(displayName({ name, email })).toBe(expected);
});
