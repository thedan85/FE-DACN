import type { CreateAdminUserInput } from "../api/users.api";

import { isValidPhone, normalizePhone, PHONE_ERROR_MESSAGE } from "./phone";

/**
 * The create form's values and the rules it validates against.
 *
 * The hard rules mirror `POST admin/users` (`docs/admin-users-api.md`): name and
 * email are required and at most 255 characters, the phone is 10–15 digits with
 * an optional leading `+`. Passwords need at least 8 characters and at most
 * 72 UTF-8 bytes to respect bcrypt's limit, even though the request DTO allows
 * 128 characters. A 12-character mix is advice, not a submission requirement.
 *
 * Keeping the rules here rather than inside the component lets the field
 * validators, the tests, and the request builder share one definition.
 */

export const USER_NAME_MAX_LENGTH = 255;
export const USER_EMAIL_MAX_LENGTH = 255;
export const USER_ADDRESS_MAX_LENGTH = 255;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_RECOMMENDED_LENGTH = 12;

export type UserCreateFormValues = {
	name: string;
	email: string;
	phone: string;
	address?: string;
	/** The role `code`; the request calls this `roleCode`. */
	role: string;
	/** A known role code, used when the role list cannot be read. */
	customRoleCode?: string;
	password: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateUserName(value: string): string | null {
	const name = value.trim();

	if (!name) {
		return "Enter the user's full name.";
	}

	if (name.length > USER_NAME_MAX_LENGTH) {
		return `Name must be ${USER_NAME_MAX_LENGTH} characters or fewer.`;
	}

	return null;
}

export function validateUserEmail(value: string): string | null {
	const email = value.trim();

	if (!email) {
		return "Enter the user's email address.";
	}

	// Length before format: a 260-character string is both too long and likely
	// malformed, and the length is the constraint the field can state plainly.
	if (email.length > USER_EMAIL_MAX_LENGTH) {
		return `Email must be ${USER_EMAIL_MAX_LENGTH} characters or fewer.`;
	}

	if (!EMAIL_PATTERN.test(email)) {
		return "Enter a valid email address, e.g. name@example.com.";
	}

	return null;
}

export function validateUserPhone(value: string): string | null {
	const phone = normalizePhone(value);

	if (!phone) {
		return "Enter the user's phone number.";
	}

	return isValidPhone(phone) ? null : PHONE_ERROR_MESSAGE;
}

export function validateUserPassword(value: string): string | null {
	if (!value) {
		return "Set a password for this user.";
	}

	if (value.length < PASSWORD_MIN_LENGTH || new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) {
		return "Password must be 8–72 bytes (about 72 characters, fewer if it has accented or non-Latin characters).";
	}

	return null;
}

/** The optional address is only invalid when it is too long. */
export function validateUserAddress(value: string): string | null {
	return value.trim().length > USER_ADDRESS_MAX_LENGTH
		? `Address must be ${USER_ADDRESS_MAX_LENGTH} characters or fewer.`
		: null;
}

export type PasswordCheckKey =
	| "length"
	| "lower"
	| "upper"
	| "number"
	| "symbol";

export type PasswordCheck = {
	key: PasswordCheckKey;
	label: string;
	met: boolean;
};

const PASSWORD_CHECKS: ReadonlyArray<{
	key: PasswordCheckKey;
	label: string;
	test: (value: string) => boolean;
}> = [
	{
		key: "length",
		label: `${PASSWORD_RECOMMENDED_LENGTH} or more characters`,
		test: (value) => value.length >= PASSWORD_RECOMMENDED_LENGTH,
	},
	{ key: "upper", label: "An uppercase letter", test: (value) => /[A-Z]/.test(value) },
	{ key: "lower", label: "A lowercase letter", test: (value) => /[a-z]/.test(value) },
	{ key: "number", label: "A number", test: (value) => /\d/.test(value) },
	{
		key: "symbol",
		label: "A symbol",
		test: (value) => /[^A-Za-z0-9]/.test(value),
	},
];

/** The advice checklist, evaluated for the current value. */
export function passwordChecklist(value: string): PasswordCheck[] {
	return PASSWORD_CHECKS.map(({ key, label, test }) => ({
		key,
		label,
		met: test(value),
	}));
}

export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4;

const PASSWORD_STRENGTH_LABELS: Record<PasswordStrengthLevel, string> = {
	0: "Too short",
	1: "Weak",
	2: "Fair",
	3: "Good",
	4: "Strong",
};

/**
 * A four-step meter for the advice above. The hard 8-character rule still
 * decides whether the form submits; this only describes how well the password
 * follows the recommendation.
 */
export function passwordStrength(value: string): PasswordStrengthLevel {
	if (value.length < PASSWORD_MIN_LENGTH) {
		return 0;
	}

	const met = passwordChecklist(value).filter((check) => check.met).length;

	// "Strong" is reserved for a password that also meets the 12-character
	// recommendation. A short password with every character class can still be
	// guessed; four met checks alone should not read as the best result.
	if (met >= 4 && value.length >= PASSWORD_RECOMMENDED_LENGTH) {
		return 4;
	}

	if (met >= 3) {
		return 3;
	}

	if (met === 2) {
		return 2;
	}

	return 1;
}

export function passwordStrengthLabel(level: PasswordStrengthLevel): string {
	return PASSWORD_STRENGTH_LABELS[level];
}

/**
 * The request body. The backend trims and lowercases the email itself, but the
 * form trims everything it can so the payload matches what the user saw. The
 * phone is sent without formatting because that is the shape the API validates.
 * A blank optional address is omitted rather than sent as `""`.
 */
export function toCreateAdminUserInput(
	values: UserCreateFormValues,
): CreateAdminUserInput {
	const address = values.address?.trim();

	return {
		name: values.name.trim(),
		email: values.email.trim(),
		phone: normalizePhone(values.phone),
		address: address ? address : undefined,
		roleCode: values.customRoleCode?.trim() || values.role,
		password: values.password,
	};
}
