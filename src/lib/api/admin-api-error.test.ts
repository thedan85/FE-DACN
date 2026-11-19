import { expect, it } from "vitest";
import { ApiError } from "./client";
import { describeAdminApiFailure } from "./admin-api-error";

it.each([
	[401, "session-expired", "Your session has ended"],
	[403, "forbidden", "You don't have permission to do this"],
	[0, "connection", "We couldn't reach the server. Check your connection and try again."],
	[404, "not-found", "Missing"],
	[409, "message", "Missing"],
])("classifies HTTP %i without exposing transport details", (status, kind, message) => {
	expect(describeAdminApiFailure(new ApiError("Missing", status), "Fallback")).toEqual({ kind, message });
});
