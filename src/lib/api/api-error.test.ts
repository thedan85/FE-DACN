import { expect, it } from "vitest";

import { ApiError } from "./client";
import { apiErrorMessage, isConflict } from "./api-error";

it("repeats the server's own words for an HTTP failure", () => {
	expect(apiErrorMessage(new ApiError("Email already exists", 409), "fallback")).toBe(
		"Email already exists",
	);
});

it("uses the caller's fallback for a transport failure", () => {
	expect(apiErrorMessage(new ApiError("fetch failed", 0), "Check your connection.")).toBe(
		"Check your connection.",
	);
});

it("uses the fallback for anything that is not an ApiError", () => {
	expect(apiErrorMessage(new Error("boom"), "Try again.")).toBe("Try again.");
});

it("identifies conflicts by status, not by message", () => {
	expect(isConflict(new ApiError("Email already exists", 409))).toBe(true);
	expect(isConflict(new ApiError("Access denied", 403))).toBe(false);
	expect(isConflict(new Error("boom"))).toBe(false);
});
