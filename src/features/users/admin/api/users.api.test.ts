import { afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import {
	createAdminUser,
	deleteAdminUser,
	getAdminUser,
	listAdminUsers,
	setAdminUserRole,
	setAdminUserStatus,
} from "./users.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

/** A `UserSummary` shaped exactly like the live backend's list row. */
const userFixture = {
	userId: "USR_alice-test-com-1",
	email: "alice@test.com",
	name: "Alice User",
	phone: "0900000001",
	roleCode: "employee",
	roleName: "Employee",
	status: "ACTIVE",
	lastLogin: null,
	createdAt: "2026-11-09T09:08:58.991413Z",
};

const detailFixture = {
	...userFixture,
	address: "Test Address",
	permissions: [],
};

function stubFetch(...responses: unknown[]) {
	const fetch = vi.fn();
	for (const response of responses) {
		fetch.mockResolvedValueOnce(
			new Response(JSON.stringify(response), {
				headers: { "Content-Type": "application/json" },
			}),
		);
	}
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

function ok(data: unknown) {
	return { code: 200, message: "OK", data };
}

it("lists with the backend's query names and both required headers", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const page = {
		content: [userFixture],
		page: 0,
		size: 20,
		totalElements: 1,
		totalPages: 1,
	};
	const fetch = stubFetch(ok(page));

	const result = await listAdminUsers({
		keyword: "alice",
		roleCode: "employee",
		status: "LOCKED",
		sort: "createdAt,desc",
		page: 2,
		size: 20,
	});

	expect(result).toEqual(page);
	const [url, init] = fetch.mock.calls[0];
	const parsed = new URL(String(url));
	expect(parsed.pathname).toBe("/api/v1/admin/users");
	expect(parsed.searchParams.get("keyword")).toBe("alice");
	expect(parsed.searchParams.get("roleCode")).toBe("employee");
	expect(parsed.searchParams.get("status")).toBe("LOCKED");
	expect(parsed.searchParams.get("sort")).toBe("createdAt,desc");
	expect(parsed.searchParams.get("page")).toBe("2");
	expect(parsed.searchParams.get("size")).toBe("20");
	expect(init.headers.get("Authorization")).toBe("Bearer test-token");
	// Operator's server locale must not leak Vietnamese errors into an English
	// UI.
	expect(init.headers.get("Accept-Language")).toBe("en");
	// These endpoints authenticate with the bearer token only.
	expect(init.credentials).toBeUndefined();
});

it("omits the optional filters rather than sending empty strings", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(
		ok({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
	);

	await listAdminUsers({ page: 0, size: 20 });

	const url = new URL(String(fetch.mock.calls[0][0]));
	expect(url.searchParams.has("keyword")).toBe(false);
	expect(url.searchParams.has("roleCode")).toBe(false);
	expect(url.searchParams.has("status")).toBe(false);
	expect(url.searchParams.has("sort")).toBe(false);
});

it("fetches one user and parses the detail-only fields", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok(detailFixture));

	const detail = await getAdminUser("USR/1");

	expect(detail.address).toBe("Test Address");
	expect(detail.permissions).toEqual([]);
	expect(new URL(String(fetch.mock.calls[0][0])).pathname).toBe(
		"/api/v1/admin/users/USR%2F1",
	);
});

it.each([null, ""])("accepts name=%j in every detail response, including writes", async (name) => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const detail = { ...detailFixture, name, phone: null, address: null, lastLogin: null };
	stubFetch(ok(detail), ok(detail), ok(detail), ok(detail));

	expect(await getAdminUser("USR_1")).toEqual(detail);
	expect(await createAdminUser({
		email: "alice@test.com",
		password: "test-only-password",
		name: "Alice User",
		phone: "0900000001",
		roleCode: "employee",
	})).toEqual(detail);
	expect(await setAdminUserStatus("USR_1", "LOCKED")).toEqual(detail);
	expect(await setAdminUserRole("USR_1", "admin")).toEqual(detail);
});

it("creates through a single POST with the exact body", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok(detailFixture));

	await createAdminUser({
		email: "alice@test.com",
		password: "correct horse battery",
		name: "Alice User",
		phone: "0900000001",
		address: "Test Address",
		roleCode: "employee",
	});

	expect(fetch).toHaveBeenCalledTimes(1);
	const [url, init] = fetch.mock.calls[0];
	expect(init.method).toBe("POST");
	expect(new URL(String(url)).pathname).toBe("/api/v1/admin/users");
	expect(JSON.parse(String(init.body))).toEqual({
		email: "alice@test.com",
		password: "correct horse battery",
		name: "Alice User",
		phone: "0900000001",
		address: "Test Address",
		roleCode: "employee",
	});
});

it("patches status and role through their own sub-paths", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(
		ok({ ...detailFixture, status: "LOCKED" }),
		ok({ ...detailFixture, roleCode: "admin" }),
	);

	const locked = await setAdminUserStatus("USR_1", "LOCKED");
	const promoted = await setAdminUserRole("USR_1", "admin");

	expect(locked.status).toBe("LOCKED");
	expect(promoted.roleCode).toBe("admin");
	expect(fetch.mock.calls[0][1].method).toBe("PATCH");
	expect(new URL(String(fetch.mock.calls[0][0])).pathname).toBe(
		"/api/v1/admin/users/USR_1/status",
	);
	expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual({
		status: "LOCKED",
	});
	expect(new URL(String(fetch.mock.calls[1][0])).pathname).toBe(
		"/api/v1/admin/users/USR_1/role",
	);
	expect(JSON.parse(String(fetch.mock.calls[1][1].body))).toEqual({
		roleCode: "admin",
	});
});

it("accepts the 200-with-null delete response", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok(null));

	await expect(deleteAdminUser("USR_1")).resolves.toBeUndefined();

	const [url, init] = fetch.mock.calls[0];
	expect(init.method).toBe("DELETE");
	expect(new URL(String(url)).pathname).toBe("/api/v1/admin/users/USR_1");
});

it("rejects a response that does not match the contract", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	stubFetch(ok({ userId: "USR_1" }));

	await expect(getAdminUser("USR_1")).rejects.toBeInstanceOf(ApiError);
});

it("rejects a page whose content rows are not user summaries", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	stubFetch(
		ok({
			content: [{ userId: "USR_1" }],
			page: 0,
			size: 20,
			totalElements: 1,
			totalPages: 1,
		}),
	);

	await expect(listAdminUsers({ page: 0, size: 20 })).rejects.toBeInstanceOf(
		ApiError,
	);
});
