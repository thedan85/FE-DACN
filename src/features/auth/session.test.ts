import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clearSession,
	getAccessToken,
	getAuthHeaders,
	getSessionGeneration,
	onSessionChange,
	setAccessToken,
	updateAccessToken,
} from "./session";

const observers: Array<() => void> = [];
function observe(listener: () => void) {
	const unsubscribe = onSessionChange(listener);
	observers.push(unsubscribe);
	return unsubscribe;
}
afterEach(() => {
	for (const unsubscribe of observers.splice(0)) unsubscribe();
	clearSession();
});

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

describe("session change observation", () => {
	it("registers and unsubscribes without mutating or immediately delivering session state", () => {
		setAccessToken("existing");
		const generation = getSessionGeneration();
		const listener = vi.fn();
		const unsubscribe = observe(listener);
		expect(listener).not.toHaveBeenCalled();
		expect(getSessionGeneration()).toBe(generation);
		expect(getAccessToken()).toBe("existing");
		unsubscribe();
		unsubscribe();
		setAccessToken("replacement");
		clearSession();
		expect(listener).not.toHaveBeenCalled();
	});

	it("notifies synchronously with no arguments after both token and generation writes on set and clear", () => {
		const generation = getSessionGeneration();
		const states: Array<{ token: string | null; generation: number }> = [];
		const listener = vi.fn(() => {
			states.push({ token: getAccessToken(), generation: getSessionGeneration() });
		});
		observe(listener);
		expect(setAccessToken("new-session")).toBeUndefined();
		expect(states).toEqual([{ token: "new-session", generation: generation + 1 }]);
		expect(clearSession()).toBeUndefined();
		expect(states).toEqual([
			{ token: "new-session", generation: generation + 1 },
			{ token: null, generation: generation + 2 },
		]);
		expect(listener.mock.calls).toEqual([[], []]);
	});

	it("isolates throwing observers without interrupting later listeners or session mutation", () => {
		observe(() => { throw new Error("local observer failure"); });
		const listener = vi.fn();
		observe(listener);
		const generation = getSessionGeneration();
		expect(() => setAccessToken("new-session")).not.toThrow();
		expect(getAccessToken()).toBe("new-session");
		expect(getSessionGeneration()).toBe(generation + 1);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(() => clearSession()).not.toThrow();
		expect(getAccessToken()).toBeNull();
		expect(getSessionGeneration()).toBe(generation + 2);
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("supports synchronous self-removal, removal of a pending listener, and next-delivery registration", () => {
		const calls: string[] = [];
		let removePending = () => {};
		const removeSelf = observe(() => {
			calls.push("first");
			removeSelf();
			removePending();
			observe(() => { calls.push("new"); });
		});
		removePending = observe(() => { calls.push("removed"); });
		setAccessToken("first");
		expect(calls).toEqual(["first"]);
		clearSession();
		expect(calls).toEqual(["first", "new"]);
	});

	it("does not notify or advance generation for accepted or rejected same-session refreshes", () => {
		setAccessToken("initial");
		const generation = getSessionGeneration();
		const listener = vi.fn();
		observe(listener);
		expect(updateAccessToken("refreshed", generation)).toBe(true);
		expect(updateAccessToken("stale", generation - 1)).toBe(false);
		expect(getAccessToken()).toBe("refreshed");
		expect(getSessionGeneration()).toBe(generation);
		expect(listener).not.toHaveBeenCalled();
		clearSession();
		listener.mockClear();
		const guestGeneration = getSessionGeneration();
		expect(updateAccessToken("unexpected", guestGeneration)).toBe(false);
		expect(getAccessToken()).toBeNull();
		expect(getSessionGeneration()).toBe(guestGeneration);
		expect(listener).not.toHaveBeenCalled();
	});

	it("notifies on every new generation including same-token replacement and an already-cleared session", () => {
		const listener = vi.fn();
		observe(listener);
		const generation = getSessionGeneration();
		setAccessToken("same");
		setAccessToken("same");
		clearSession();
		clearSession();
		expect(getSessionGeneration()).toBe(generation + 4);
		expect(listener).toHaveBeenCalledTimes(4);
	});
});
