import { expect, it } from "vitest";

import {
	CREATE_FORM_ERROR,
	classifyCreateConflict,
	parseCreateValidationError,
} from "./create-errors";

it("splits the backend's one-string validation error onto its fields", () => {
	const message =
		"email: email is required; name: name is required; password: password must be 8-128 characters; phone: phone must be 10-15 digits; roleCode: roleCode is required";

	const parsed = parseCreateValidationError(message);

	expect(parsed.fields).toEqual({
		email: "email is required",
		name: "name is required",
		password: "password must be 8-128 characters",
		phone: "phone must be 10-15 digits",
		role: "roleCode is required",
	});
	expect(parsed.unparsed).toBeNull();
});

it("keeps text it cannot attribute instead of dropping the failure", () => {
	const parsed = parseCreateValidationError(
		"email: email is required; Address must be shorter",
	);

	expect(parsed.fields.email).toBe("email is required");
	expect(parsed.unparsed).toBe("Address must be shorter");
});

it("leaves a non-segmented message entirely in the banner", () => {
	expect(parseCreateValidationError("Request body is malformed")).toEqual({
		fields: {},
		unparsed: "Request body is malformed",
	});
	expect(parseCreateValidationError("")).toEqual({
		fields: {},
		unparsed: null,
	});
});

it("ignores collisions and empty explanations", () => {
	const parsed = parseCreateValidationError(
		"email: first problem; email: second problem; name:",
	);

	expect(parsed.fields.email).toBe("first problem");
	// `name:` has no explanation, so it stays visible rather than becoming an
	// empty error under the control.
	expect(parsed.fields.name).toBeUndefined();
	expect(parsed.unparsed).toBe("name:");
});

it("puts a duplicate email on the email field and everything else in the banner", () => {
	expect(classifyCreateConflict("Email already exists")).toEqual({
		kind: "email",
		message: "Email already exists",
	});
	expect(
		classifyCreateConflict(
			"Invalid role; only employee and admin are supported",
		),
	).toEqual({
		kind: "form",
		message: "Invalid role; only employee and admin are supported",
	});
});

it("has a form fallback that names the place to fix", () => {
	expect(CREATE_FORM_ERROR).toMatch(/Correct the fields below/);
});
