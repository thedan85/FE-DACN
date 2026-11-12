import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearSession,
	getAccessToken,
	setAccessToken,
} from "@/features/auth/session";
import { ApiError } from "@/lib/api/client";
import { fetchRealtimeCredentials } from "./realtime.api";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/lib/api/client", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/lib/api/client")>();
	return { ...original, apiFetch: apiFetchMock };
});

const CREDENTIAL = {
	accessToken: "supabase-jwt",
	expiresAt: "2026-11-04T10:05:00Z",
	admittedProductIds: ["p1"],
	inboxTopic: "inbox:7",
};

const REFRESHED_SESSION = {
	code: 200,
	message: "OK",
	data: {
		accessToken: "refreshed-token",
		expiresIn: 300,
		tokenType: "Bearer",
	},
};

describe("fetchRealtimeCredentials", () => {
	beforeEach(() => {
		apiFetchMock.mockReset();
		setAccessToken("spring-token");
	});

	afterEach(clearSession);

	it("posts the requested ids with the Spring bearer token", async () => {
		apiFetchMock.mockResolvedValue({ code: 200, message: "OK", data: CREDENTIAL });

		await expect(fetchRealtimeCredentials(["p1", "p2"])).resolves.toEqual(CREDENTIAL);

		expect(apiFetchMock).toHaveBeenCalledWith("realtime/credentials", {
			method: "POST",
			headers: { Authorization: "Bearer spring-token" },
			body: JSON.stringify({ productIds: ["p1", "p2"] }),
		});
	});

	it("rejects a malformed envelope instead of fabricating a token", async () => {
		apiFetchMock.mockResolvedValue({
			code: 200,
			message: "OK",
			data: { accessToken: "", expiresAt: "soon" },
		});

		await expect(fetchRealtimeCredentials(["p1"])).rejects.toBeInstanceOf(ApiError);
	});

	it("propagates a 503 without retrying", async () => {
		apiFetchMock.mockRejectedValue(new ApiError("unavailable", 503));

		await expect(fetchRealtimeCredentials(["p1"])).rejects.toMatchObject({
			status: 503,
		});
		expect(apiFetchMock).toHaveBeenCalledTimes(1);
	});

	it("refreshes an expired bearer and retries once with the new token", async () => {
		apiFetchMock
			.mockRejectedValueOnce(new ApiError("expired", 401))
			.mockResolvedValueOnce(REFRESHED_SESSION)
			.mockResolvedValueOnce({ code: 200, message: "OK", data: CREDENTIAL });

		await expect(fetchRealtimeCredentials(["p1"])).resolves.toEqual(CREDENTIAL);

		expect(apiFetchMock.mock.calls.map(([path]) => path)).toEqual([
			"realtime/credentials",
			"auth/refresh",
			"realtime/credentials",
		]);
		expect(
			new Headers(apiFetchMock.mock.calls[2][1]?.headers).get("Authorization"),
		).toBe("Bearer refreshed-token");
		expect(getAccessToken()).toBe("refreshed-token");
	});

	it("fails closed without a guest request when the refresh fails", async () => {
		apiFetchMock
			.mockRejectedValueOnce(new ApiError("expired", 401))
			.mockRejectedValueOnce(new ApiError("refresh rejected", 401));

		await expect(fetchRealtimeCredentials(["p1"])).rejects.toMatchObject({
			status: 401,
		});

		expect(apiFetchMock.mock.calls.map(([path]) => path)).toEqual([
			"realtime/credentials",
			"auth/refresh",
		]);
	});

	it("does not loop when the refreshed bearer is still rejected", async () => {
		apiFetchMock
			.mockRejectedValueOnce(new ApiError("expired", 401))
			.mockResolvedValueOnce(REFRESHED_SESSION)
			.mockRejectedValueOnce(new ApiError("expired", 401));

		await expect(fetchRealtimeCredentials(["p1"])).rejects.toMatchObject({
			status: 401,
		});

		expect(apiFetchMock).toHaveBeenCalledTimes(3);
	});

	it("propagates a guest 401 without refreshing", async () => {
		clearSession();
		apiFetchMock.mockRejectedValue(new ApiError("unauthorized", 401));

		await expect(fetchRealtimeCredentials(["p1"])).rejects.toMatchObject({
			status: 401,
		});

		expect(apiFetchMock).toHaveBeenCalledTimes(1);
		expect(apiFetchMock).toHaveBeenCalledWith("realtime/credentials", {
			method: "POST",
			headers: {},
			body: JSON.stringify({ productIds: ["p1"] }),
		});
	});

	it("coalesces concurrent 401s into one refresh", async () => {
		let resolveRefresh: (value: unknown) => void = () => {};
		const refreshResponse = new Promise((resolve) => {
			resolveRefresh = resolve;
		});
		let credentialAttempts = 0;

		apiFetchMock.mockImplementation((path: string) => {
			if (path === "auth/refresh") {
				return refreshResponse;
			}

			credentialAttempts += 1;

			return credentialAttempts <= 2
				? Promise.reject(new ApiError("expired", 401))
				: Promise.resolve({ code: 200, message: "OK", data: CREDENTIAL });
		});

		const requests = [
			fetchRealtimeCredentials(["p1"]),
			fetchRealtimeCredentials(["p2"]),
		];

		await new Promise((resolve) => setTimeout(resolve, 0));

		const refreshCalls = () =>
			apiFetchMock.mock.calls.filter(([path]) => path === "auth/refresh");

		expect(refreshCalls()).toHaveLength(1);

		resolveRefresh(REFRESHED_SESSION);

		await expect(Promise.all(requests)).resolves.toEqual([CREDENTIAL, CREDENTIAL]);
		expect(refreshCalls()).toHaveLength(1);
		expect(getAccessToken()).toBe("refreshed-token");
	});
});

describe("realtime credentials HTTP boundary", () => {
	const fetchMock = vi.fn<typeof fetch>();

	beforeEach(async () => {
		const original = await vi.importActual<typeof import("@/lib/api/client")>(
			"@/lib/api/client",
		);
		apiFetchMock.mockReset().mockImplementation(original.apiFetch);
		fetchMock.mockReset();
		clearSession();
		vi.stubGlobal("fetch", fetchMock);
		vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);
	});

	afterEach(() => {
		clearSession();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it.each([null, "current-spring-token"])(
		"uses centralized headers and no-store for guest/authenticated session %s",
		async (token) => {
			if (token) setAccessToken(token);
			const credential = { ...CREDENTIAL, inboxTopic: token ? CREDENTIAL.inboxTopic : null };
			fetchMock.mockResolvedValue(
				Response.json({ code: 200, message: "OK", data: credential }),
			);

			await expect(fetchRealtimeCredentials([])).resolves.toEqual(credential);

			expect(fetchMock).toHaveBeenCalledTimes(1);
			const [url, init] = fetchMock.mock.calls[0];
			expect(String(url)).toBe("http://localhost:8080/api/v1/realtime/credentials");
			expect(init).toMatchObject({
				method: "POST",
				cache: "no-store",
				body: JSON.stringify({ productIds: [] }),
			});
			const headers = new Headers(init?.headers);
			expect(headers.get("Accept")).toBe("application/json");
			expect(headers.get("Content-Type")).toBe("application/json");
			expect(headers.get("Authorization")).toBe(token ? `Bearer ${token}` : null);
		},
	);

	it.each([
		{ code: "200", message: "OK", data: CREDENTIAL },
		{ code: 200, data: CREDENTIAL },
		{ code: 200, message: "OK", data: null },
		{ code: 200, message: "OK", data: { ...CREDENTIAL, accessToken: "" } },
		{ code: 200, message: "OK", data: { ...CREDENTIAL, expiresAt: "soon" } },
		{ code: 200, message: "OK", data: { ...CREDENTIAL, admittedProductIds: [1] } },
		{ code: 200, message: "OK", data: { ...CREDENTIAL, inboxTopic: 7 } },
	])("rejects malformed Spring envelopes without echoing the token: %j", async (body) => {
		fetchMock.mockResolvedValue(Response.json(body));

		await expect(fetchRealtimeCredentials(["p1"])).rejects.toMatchObject({
			name: "ApiError",
			status: 500,
			message: "Realtime credentials did not match the expected contract.",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("propagates HTTP 503 without retrying", async () => {
		setAccessToken("current-spring-token");
		fetchMock.mockResolvedValue(Response.json({
			code: 503,
			message: "realtime credentials unavailable",
			data: null,
		}, { status: 503 }));

		await expect(fetchRealtimeCredentials(["p1"])).rejects.toMatchObject({
			status: 503,
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization"))
			.toBe("Bearer current-spring-token");
	});

	it("does not retry as a guest after the refresh cookie is rejected", async () => {
		setAccessToken("expired-spring-token");
		fetchMock.mockImplementation(async (input) => {
			const url = String(input);

			return url.endsWith("/auth/refresh")
				? Response.json(
						{ code: 401, message: "refresh rejected", data: null },
						{ status: 401 },
					)
				: Response.json(
						{ code: 401, message: "expired token", data: null },
						{ status: 401 },
					);
		});

		await expect(fetchRealtimeCredentials(["p1"])).rejects.toMatchObject({
			status: 401,
		});

		const credentialCalls = fetchMock.mock.calls.filter(([input]) =>
			String(input).endsWith("/realtime/credentials"),
		);
		expect(credentialCalls).toHaveLength(1);
		expect(new Headers(credentialCalls[0][1]?.headers).get("Authorization"))
			.toBe("Bearer expired-spring-token");
	});

	it.each([null, "other-account-token", "expired-spring-token"])(
		"does not restore an obsolete refresh after switching to %s",
		async (nextToken) => {
			setAccessToken("expired-spring-token");
			const refresh = Promise.withResolvers<Response>();
			const started = Promise.withResolvers<void>();
			fetchMock.mockImplementation(async (input) => {
				if (String(input).endsWith("/auth/refresh")) {
					started.resolve();
					return refresh.promise;
				}
				return fetchMock.mock.calls.length === 1
					? Response.json({ message: "expired" }, { status: 401 })
					: Response.json({ code: 200, message: "OK", data: CREDENTIAL });
			});

			const outcome = Promise.allSettled([fetchRealtimeCredentials(["p1"])]);
			await started.promise;
			clearSession();
			if (nextToken) setAccessToken(nextToken);
			refresh.resolve(Response.json(REFRESHED_SESSION));
			const [result] = await outcome;

			expect(getAccessToken()).toBe(nextToken);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization"))
				.toBe("Bearer expired-spring-token");
			expect(fetchMock.mock.calls[1][1]?.credentials).toBe("include");
			expect(result).toMatchObject({ status: "rejected", reason: { status: 401 } });
		},
	);

	it.each([
		["expired-spring-token", null],
		["expired-spring-token", "other-account-token"],
		["expired-spring-token", "expired-spring-token"],
		[null, "other-account-token"],
	])("does not refresh a delayed 401 from %s after switching to %s", async (token, nextToken) => {
		if (token) setAccessToken(token);
		const original = Promise.withResolvers<Response>();
		fetchMock
			.mockReturnValueOnce(original.promise)
			.mockResolvedValueOnce(Response.json(REFRESHED_SESSION))
			.mockResolvedValueOnce(Response.json({ code: 200, message: "OK", data: CREDENTIAL }));
		const outcome = Promise.allSettled([fetchRealtimeCredentials(["p1"])]);

		clearSession();
		if (nextToken) setAccessToken(nextToken);
		original.resolve(Response.json({ message: "expired" }, { status: 401 }));
		const [result] = await outcome;

		expect(getAccessToken()).toBe(nextToken);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization"))
			.toBe(token ? `Bearer ${token}` : null);
		expect(result).toMatchObject({ status: "rejected", reason: { status: 401 } });
	});

	it.each([false, true])("rejects stale credential success after a session change (retry=%s)", async (retry) => {
		setAccessToken("expired-spring-token");
		const response = Promise.withResolvers<Response>();
		const started = Promise.withResolvers<void>();
		fetchMock.mockImplementation(async (input) => {
			if (String(input).endsWith("/auth/refresh")) {
				return Response.json(REFRESHED_SESSION);
			}
			if (retry && fetchMock.mock.calls.length === 1) {
				return Response.json({ message: "expired" }, { status: 401 });
			}
			started.resolve();
			return response.promise;
		});
		const outcome = Promise.allSettled([fetchRealtimeCredentials(["p1"])]);
		await started.promise;
		setAccessToken("other-account-token");
		response.resolve(Response.json({ code: 200, message: "OK", data: CREDENTIAL }));
		const [result] = await outcome;

		expect(getAccessToken()).toBe("other-account-token");
		expect(fetchMock).toHaveBeenCalledTimes(retry ? 3 : 1);
		expect(new Headers(fetchMock.mock.calls.at(-1)?.[1]?.headers).get("Authorization"))
			.toBe(retry ? "Bearer refreshed-token" : "Bearer expired-spring-token");
		expect(result).toMatchObject({ status: "rejected", reason: { status: 401 } });
	});

	it("coalesces same-session HTTP refreshes and retries each request once", async () => {
		setAccessToken("expired-spring-token");
		const refresh = Promise.withResolvers<Response>();
		let credentialAttempts = 0;
		fetchMock.mockImplementation(async (input) => {
			if (String(input).endsWith("/auth/refresh")) return refresh.promise;
			credentialAttempts += 1;
			return credentialAttempts <= 2
				? Response.json({ message: "expired" }, { status: 401 })
				: Response.json({ code: 200, message: "OK", data: CREDENTIAL });
		});
		const requests = [fetchRealtimeCredentials(["p1"]), fetchRealtimeCredentials(["p2"])];
		const outcome = Promise.allSettled(requests);
		await Promise.allSettled(apiFetchMock.mock.results.map(({ value }) => value));
		refresh.resolve(Response.json(REFRESHED_SESSION));

		expect(await outcome).toEqual([
			{ status: "fulfilled", value: CREDENTIAL },
			{ status: "fulfilled", value: CREDENTIAL },
		]);
		expect(getAccessToken()).toBe("refreshed-token");
		expect(fetchMock.mock.calls.map(([input, init]) => [
			new URL(String(input)).pathname,
			new Headers(init?.headers).get("Authorization"),
		])).toEqual([
			["/api/v1/realtime/credentials", "Bearer expired-spring-token"],
			["/api/v1/realtime/credentials", "Bearer expired-spring-token"],
			["/api/v1/auth/refresh", null],
			["/api/v1/realtime/credentials", "Bearer refreshed-token"],
			["/api/v1/realtime/credentials", "Bearer refreshed-token"],
		]);
		expect(fetchMock.mock.calls[2][1]?.credentials).toBe("include");
	});

	it.each([false, true])("keeps the newer session's refresh ownership when the old refresh settles (failure=%s)", async (failure) => {
		setAccessToken("expired-spring-token");
		const oldRefresh = Promise.withResolvers<Response>();
		const newRefresh = Promise.withResolvers<Response>();
		const oldStarted = Promise.withResolvers<void>();
		let refreshCount = 0;
		fetchMock.mockImplementation(async (input, init) => {
			if (String(input).endsWith("/auth/refresh")) {
				refreshCount += 1;
				oldStarted.resolve();
				return refreshCount === 1 ? oldRefresh.promise : newRefresh.promise;
			}
			return new Headers(init?.headers).get("Authorization") === "Bearer refreshed-token"
				? Response.json({ code: 200, message: "OK", data: CREDENTIAL })
				: Response.json({ message: "expired" }, { status: 401 });
		});
		const oldOutcome = Promise.allSettled([fetchRealtimeCredentials(["p1"])]);
		const outcomes = [oldOutcome];
		await oldStarted.promise;
		setAccessToken("other-account-token");
		const newOutcome = Promise.allSettled([fetchRealtimeCredentials(["p2"])]);
		outcomes.push(newOutcome);
		await expect(apiFetchMock.mock.results.at(-1)?.value).rejects.toMatchObject({ status: 401 });

		try {
			expect(refreshCount).toBe(2);
			oldRefresh.resolve(failure
				? Response.json({ message: "refresh rejected" }, { status: 401 })
				: Response.json(REFRESHED_SESSION));
			expect(await oldOutcome).toMatchObject([{ status: "rejected", reason: { status: 401 } }]);
			expect(getAccessToken()).toBe("other-account-token");

			const concurrentOutcome = Promise.allSettled([fetchRealtimeCredentials(["p3"])]);
			outcomes.push(concurrentOutcome);
			await expect(apiFetchMock.mock.results.at(-1)?.value).rejects.toMatchObject({ status: 401 });
			newRefresh.resolve(Response.json(REFRESHED_SESSION));
			expect(await newOutcome).toEqual([{ status: "fulfilled", value: CREDENTIAL }]);
			expect(await concurrentOutcome).toEqual([{ status: "fulfilled", value: CREDENTIAL }]);
			expect(refreshCount).toBe(2);
			expect(getAccessToken()).toBe("refreshed-token");
			const credentialHeaders = fetchMock.mock.calls
				.filter(([input]) => String(input).endsWith("/realtime/credentials"))
				.map(([, init]) => new Headers(init?.headers).get("Authorization"));
			expect(credentialHeaders).toEqual([
				"Bearer expired-spring-token", "Bearer other-account-token",
				"Bearer other-account-token", "Bearer refreshed-token", "Bearer refreshed-token",
			]);
		} finally {
			oldRefresh.resolve(Response.json(REFRESHED_SESSION));
			newRefresh.resolve(Response.json(REFRESHED_SESSION));
			await Promise.all(outcomes);
		}
	});
});
