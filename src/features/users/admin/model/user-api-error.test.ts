import { expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";

import {
	CONNECTION_ERROR_MESSAGE,
	FORBIDDEN_MESSAGE,
	SESSION_EXPIRED_MESSAGE,
	STALE_ROLE_CONFLICT_MESSAGE,
	describeUserApiFailure,
	normalizeUserConflict,
} from "./user-api-error";

it("treats a transport failure as unproven, not signed out", () => {
	expect(describeUserApiFailure(new ApiError("fetch failed", 0), "fallback")).toEqual(
		{ kind: "connection", message: CONNECTION_ERROR_MESSAGE },
	);
});

it("separates an ended session from a forbidden action", () => {
	expect(
		describeUserApiFailure(new ApiError("Unauthorized", 401), "fallback"),
	).toEqual({ kind: "session-expired", message: SESSION_EXPIRED_MESSAGE });
	expect(
		describeUserApiFailure(new ApiError("Access denied", 403), "fallback"),
	).toEqual({ kind: "forbidden", message: FORBIDDEN_MESSAGE });
});

it("marks a missing user so a detail screen can render a 404 result", () => {
	expect(
		describeUserApiFailure(new ApiError("user not found: USR_1", 404), "fallback"),
	).toEqual({ kind: "not-found", message: "user not found: USR_1" });
});

it("repeats the backend's words for any other HTTP failure", () => {
	expect(
		describeUserApiFailure(new ApiError("Email already exists", 409), "fallback"),
	).toEqual({ kind: "message", message: "Email already exists" });
});

it("uses the fallback for a non-ApiError and for an empty HTTP message", () => {
	expect(describeUserApiFailure(new Error("boom"), "Could not load users.")).toEqual(
		{ kind: "message", message: "Could not load users." },
	);
	expect(describeUserApiFailure(new ApiError("   ", 500), "Could not load users.")).toEqual(
		{ kind: "message", message: "Could not load users." },
	);
});

it("replaces the stale-role 409 with copy that names the next action", () => {
	expect(
		normalizeUserConflict("Invalid role; only employee and admin are supported"),
	).toBe(STALE_ROLE_CONFLICT_MESSAGE);
	// The comparison is not sensitive to surrounding whitespace or case.
	expect(
		normalizeUserConflict(
			"  invalid ROLE; only Employee and Admin are supported  ",
		),
	).toBe(STALE_ROLE_CONFLICT_MESSAGE);
});

it("shows every other 409 sentence unchanged", () => {
	expect(normalizeUserConflict("You cannot lock your own account")).toBe(
		"You cannot lock your own account",
	);
	expect(normalizeUserConflict("Cannot modify the last active administrator")).toBe(
		"Cannot modify the last active administrator",
	);
});
