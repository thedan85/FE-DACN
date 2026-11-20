import { afterEach, expect, it, vi } from "vitest";

import { register } from "./auth.api";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

function ok(data: unknown) {
	return { code: 201, message: "registered successfully", data };
}

it("register returns the auto-login session", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const data = {
		accessToken: "access-token",
		expiresIn: 900,
		tokenType: "Bearer",
		user: {
			userId: "USR_1",
			email: "new@test.com",
			name: "New User",
			phone: null,
			address: null,
			roleCode: "CUSTOMER",
			roleName: "Customer",
			permissions: [],
			hasPassword: true,
		},
	};
	const fetch = vi.fn().mockResolvedValueOnce(
		new Response(JSON.stringify(ok(data)), {
			headers: { "Content-Type": "application/json" },
		}),
	);
	vi.stubGlobal("fetch", fetch);

	const result = await register({
		name: "New User",
		email: "new@test.com",
		phone: "0901234567",
		password: "password123",
	});

	expect(result).toEqual(data);
	const [url, options] = vi.mocked(fetch).mock.calls[0];
	expect(String(url)).toBe("http://localhost:8080/api/v1/auth/register");
	expect(options).toMatchObject({ method: "POST", credentials: "include" });
});
