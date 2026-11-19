import { afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import { listAdminRoles } from "./roles.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

function stubFetch(response: unknown) {
	const fetch = vi.fn().mockResolvedValueOnce(
		new Response(JSON.stringify(response), {
			headers: { "Content-Type": "application/json" },
		}),
	);
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

it("reads a plain array with the env header", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const roles = [
		{
			roleId: "ROL_1",
			code: "employee",
			name: "Employee",
			description: null,
			system: true,
		},
		{
			roleId: "ROL_2",
			code: "admin",
			name: "Administrator",
			description: "Full access",
			system: true,
		},
	];
	const fetch = stubFetch({ code: 200, message: "OK", data: roles });

	const result = await listAdminRoles();

	expect(result).toEqual(roles);
	const [url, init] = fetch.mock.calls[0];
	expect(new URL(String(url)).pathname).toBe("/api/v1/admin/roles");
	expect(init.headers.get("Authorization")).toBe("Bearer test-token");
	expect(init.headers.get("Accept-Language")).toBe("en");
	expect(init.credentials).toBeUndefined();
});

it("rejects a role list that is not an array of roles", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	stubFetch({ code: 200, message: "OK", data: { roleId: "ROL_1" } });

	await expect(listAdminRoles()).rejects.toBeInstanceOf(ApiError);
});
