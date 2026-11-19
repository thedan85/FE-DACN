/**
 * Phone entry for the create form.
 *
 * The backend accepts 10–15 digits with an optional leading `+`, but people
 * type `(091) 234-5678`, `091.234.5678`, or `091 234 5678`. Rather than reject
 * every shape the eye reads as a phone number, the form strips the separators
 * before validating and sends the stripped value.
 */

/** Spaces, dashes, dots, and parentheses are formatting, not digits. */
const FORMATTING = /[\s\-.()]/g;

/** Digits only, with any `+` prefix kept where the caller put it. */
export function stripPhoneFormatting(value: string): string {
	return value.replace(FORMATTING, "");
}

/**
 * The value to validate and to send: formatting removed, outer whitespace gone.
 * A leading `+` survives because it carries the country-code meaning.
 */
export function normalizePhone(value: string): string {
	return stripPhoneFormatting(value.trim());
}

const PHONE_PATTERN = /^\+?\d{10,15}$/;

/** True for a normalised value: 10–15 digits, optional leading `+`. */
export function isValidPhone(value: string): boolean {
	return PHONE_PATTERN.test(value);
}

/** Shown when a phone value fails validation. */
export const PHONE_ERROR_MESSAGE =
	"Enter 10–15 digits, with an optional leading +.";
