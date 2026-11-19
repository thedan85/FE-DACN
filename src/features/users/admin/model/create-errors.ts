/**
 * Translating the create endpoint's failures into form-level state.
 *
 * The backend's 400 body is one string, not a field map:
 * `"email: email is required; name: name is required; …"`. Showing it whole
 * above the form makes every field the user's problem at once; splitting it
 * puts each sentence on the control that can fix it. The 409 body is a single
 * sentence, and only the email duplicate names a field at all.
 */

/** The form controls a backend validation message can target. */
export type UserFormField =
	| "name"
	| "email"
	| "phone"
	| "address"
	| "role"
	| "password";

export type ParsedCreateValidation = {
	fields: Partial<Record<UserFormField, string>>;
	/** Segments that named no known field, for the banner. `null` when none. */
	unparsed: string | null;
};

/**
 * The request field name to the form control that owns it. `roleCode` is the
 * wire name; the form calls it `role`, so the two vocabularies meet here rather
 * than in every screen.
 */
const FIELD_ALIASES: Record<string, UserFormField> = {
	name: "name",
	email: "email",
	phone: "phone",
	address: "address",
	// The message key is lowercased before this lookup, so the alias is too.
	rolecode: "role",
	role: "role",
	password: "password",
};

export const CREATE_FORM_ERROR =
	"We couldn't create this user. Correct the fields below.";

/**
 * Splits a 400 message into per-field errors plus any text that could not be
 * attributed. Cannot throw and never returns an empty error for a non-empty
 * message: unattributable text goes to `unparsed`, so no failure is silent.
 */
export function parseCreateValidationError(
	message: string,
): ParsedCreateValidation {
	const fields: Partial<Record<UserFormField, string>> = {};
	const leftovers: string[] = [];

	for (const segment of message.split(";")) {
		const trimmed = segment.trim();

		if (!trimmed) {
			continue;
		}

		const separator = trimmed.indexOf(":");
		const key =
			separator > 0 ? trimmed.slice(0, separator).trim().toLowerCase() : "";
		const text = separator > 0 ? trimmed.slice(separator + 1).trim() : "";
		const field = FIELD_ALIASES[key];

		if (!field || !text) {
			leftovers.push(trimmed);
			continue;
		}

		// A repeated field keeps the first explanation; later ones are rare and
		// the first is the one the backend lists against the constraint.
		fields[field] ??= text;
	}

	return {
		fields,
		unparsed: leftovers.length > 0 ? leftovers.join("; ") : null,
	};
}

export type CreateConflict =
	| { kind: "email"; message: string }
	| { kind: "form"; message: string };

/**
 * Decides where a create 409 belongs. The only 409 that names a field is the
 * duplicate email; an unknown role or a defensive phone check are form-level
 * conditions, so their backend sentence goes in the banner unaltered.
 */
export function classifyCreateConflict(message: string): CreateConflict {
	return /email/i.test(message)
		? { kind: "email", message }
		: { kind: "form", message };
}
