import { afterEach, expect, it, vi } from "vitest";

import {
	createAdminUser,
	deleteAdminUser,
	listAdminUsers,
	patchCustomerProfile,
	setAdminUserRole,
	setAdminUserStatus,
} from "./admin-users.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

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

const employee = {
	userId: "USR_employee-1",
	email: "employee@test.com",
	name: "Employee User",
	phone: "0900000003",
	roleCode: "employee",
	roleName: "Employee",
	status: "ACTIVE",
	lastLogin: null,
	createdAt: "2026-11-09T09:08:58.991413Z",
};

it("staffList_usesExactRoleAndZeroBasedPaging", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(
		ok({
			content: [employee],
			page: 0,
			size: 20,
			totalElements: 1,
			totalPages: 1,
		}),
	);

	const page = await listAdminUsers({
		page: 0,
		size: 20,
		roleCode: "employee",
		keyword: "   ",
	});

	const url = new URL(String(fetch.mock.calls[0][0]));
	expect(url.searchParams.get("roleCode")).toBe("employee");
	expect(url.searchParams.get("page")).toBe("0");
	expect(url.searchParams.has("keyword")).toBe(false);
	expect(page.content).toHaveLength(1);
});

it("sends the role assignment exactly as documented", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(
		ok({
			...employee,
			address: "Employee Desk",
			roleCode: "catalog_editor",
			roleName: "Catalog Editor",
			permissions: [],
		}),
	);

	const updated = await setAdminUserRole("USR_employee-1", "catalog_editor");

	const [input, init] = fetch.mock.calls[0] as [string, RequestInit];
	expect(new URL(String(input)).pathname).toBe(
		"/api/v1/admin/users/USR_employee-1/role",
	);
	expect(init.method).toBe("PATCH");
	expect(JSON.parse(String(init.body))).toEqual({ roleCode: "catalog_editor" });
	expect(updated.roleCode).toBe("catalog_editor");
});

it("accepts the {code:200,message:OK,data:null} deletion envelope", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	stubFetch({ code: 200, message: "OK", data: null });

	await expect(deleteAdminUser("USR_employee-1")).resolves.toBeUndefined();
});

it("parses the create response, including the 201 envelope", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch({
		code: 201,
		message: "Created",
		data: {
			...employee,
			userId: "USR_new-1",
			email: "new-employee@test.com",
			address: "New Address",
			lastLogin: null,
			permissions: [],
		},
	});

	const created = await createAdminUser({
		email: "new-employee@test.com",
		password: "newpassword123",
		name: "New Staff",
		phone: "0912345678",
		address: "New Address",
		roleCode: "employee",
	});

	const [input, init] = fetch.mock.calls[0] as [string, RequestInit];
	expect(new URL(String(input)).pathname).toBe("/api/v1/admin/users");
	expect(init.method).toBe("POST");
	expect(created.userId).toBe("USR_new-1");
});

it("sends only the supplied profile field in the patch body", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(
		ok({
			...employee,
			userId: "USR_customer",
			roleCode: "customer",
			roleName: "Customer",
			address: "Employee Desk",
			name: "New Name",
			permissions: [],
		}),
	);

	const updated = await patchCustomerProfile("USR_customer", {
		name: "New Name",
	});

	const [input, init] = fetch.mock.calls[0] as [string, RequestInit];
	expect(new URL(String(input)).pathname).toBe(
		"/api/v1/admin/users/USR_customer/profile",
	);
	expect(init.method).toBe("PATCH");
	expect(JSON.parse(String(init.body))).toEqual({ name: "New Name" });
	expect(updated.name).toBe("New Name");
});

it("sends the documented status patch body", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(
		ok({
			...employee,
			address: "Employee Desk",
			status: "LOCKED",
			permissions: [],
		}),
	);

	const updated = await setAdminUserStatus("USR_employee-1", "LOCKED");

	const [input, init] = fetch.mock.calls[0] as [string, RequestInit];
	expect(new URL(String(input)).pathname).toBe(
		"/api/v1/admin/users/USR_employee-1/status",
	);
	expect(init.method).toBe("PATCH");
	expect(JSON.parse(String(init.body))).toEqual({ status: "LOCKED" });
	expect(updated.status).toBe("LOCKED");
});
