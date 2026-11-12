import { afterEach, describe, expect, it } from "vitest";
import {
	clearSession,
	getAccessToken,
	getAuthHeaders,
	getSessionGeneration,
	setAccessToken,
	updateAccessToken,
} from "./session";

afterEach(clearSession);

describe("session refresh fence", () => {
	it("does not establish authentication by refreshing a guest generation", () => {
		clearSession();

		expect(updateAccessToken("unexpected-token", getSessionGeneration())).toBe(false);
		expect(getAccessToken()).toBeNull();
		expect(getAuthHeaders()).toEqual({});
	});

	it("rotates a current bearer without invalidating same-session requests", () => {
		setAccessToken("initial-token");
		const generation = getSessionGeneration();

		expect(updateAccessToken("refreshed-token", generation)).toBe(true);
		expect(getSessionGeneration()).toBe(generation);
		expect(getAccessToken()).toBe("refreshed-token");
		expect(getAuthHeaders()).toEqual({ Authorization: "Bearer refreshed-token" });
	});

	it.each([null, "other-token", "initial-token"])(
		"rejects an old refresh after clear/set to %s, including ABA",
		(nextToken) => {
			setAccessToken("initial-token");
			const generation = getSessionGeneration();
			clearSession();
			if (nextToken) setAccessToken(nextToken);

			expect(getSessionGeneration()).not.toBe(generation);
			expect(updateAccessToken("obsolete-token", generation)).toBe(false);
			expect(getAccessToken()).toBe(nextToken);
			expect(getAuthHeaders()).toEqual(nextToken ? { Authorization: `Bearer ${nextToken}` } : {});
		},
	);

	it.each(["other-token", "initial-token"])(
		"invalidates an old refresh on direct replacement with %s",
		(nextToken) => {
			setAccessToken("initial-token");
			const generation = getSessionGeneration();
			setAccessToken(nextToken);

			expect(updateAccessToken("obsolete-token", generation)).toBe(false);
			expect(getAccessToken()).toBe(nextToken);
			expect(getAuthHeaders()).toEqual({ Authorization: `Bearer ${nextToken}` });
		},
	);
});
