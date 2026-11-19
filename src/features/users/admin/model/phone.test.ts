import { expect, it } from "vitest";

import {
	PHONE_ERROR_MESSAGE,
	isValidPhone,
	normalizePhone,
	stripPhoneFormatting,
} from "./phone";

it("strips the separators people type, and nothing else", () => {
	expect(stripPhoneFormatting("(091) 234-5678")).toBe("0912345678");
	expect(stripPhoneFormatting("091.234.5678")).toBe("0912345678");
	expect(stripPhoneFormatting("+84 912 345 678")).toBe("+84912345678");
	// A plus is meaning, not formatting.
	expect(stripPhoneFormatting("+84912345678")).toBe("+84912345678");
});

it("normalises by trimming and stripping before validating", () => {
	expect(normalizePhone("  (091) 234-5678  ")).toBe("0912345678");
	expect(normalizePhone("   ")).toBe("");
});

it("accepts 10–15 digits with an optional leading plus", () => {
	expect(isValidPhone("0912345678")).toBe(true);
	expect(isValidPhone("+84912345678")).toBe(true);
	expect(isValidPhone("123456789012345")).toBe(true);
});

it("rejects the wrong length, foreign characters, and misplaced pluses", () => {
	expect(isValidPhone("091234567")).toBe(false);
	expect(isValidPhone("1234567890123456")).toBe(false);
	expect(isValidPhone("0912345678x")).toBe(false);
	expect(isValidPhone("++84912345678")).toBe(false);
	expect(isValidPhone("84+912345678")).toBe(false);
	expect(isValidPhone("")).toBe(false);
	// A formatted value is not valid until it has been normalised.
	expect(isValidPhone("(091) 234-5678")).toBe(false);
});

it("has copy that states the accepted shape", () => {
	expect(PHONE_ERROR_MESSAGE).toMatch(/10–15 digits/);
});
