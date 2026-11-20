import { afterEach, expect, it, vi } from "vitest";

import {
	getAdminUser,
	listAdminUsers,
	patchCustomerProfile,
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

it("decodes a customer with no profile in both list and detail responses", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const customer = {
		...employee,
		userId: "USR_customer",
		roleCode: "customer",
		roleName: "Customer",
		name: null,
		phone: null,
	};
	stubFetch(
		ok({ content: [customer], page: 0, size: 20, totalElements: 1, totalPages: 1 }),
		ok({ ...customer, address: null, permissions: [] }),
	);

	const page = await listAdminUsers({ page: 0, size: 20, roleCode: "customer" });
	expect(page.content).toEqual([customer]);
	expect(await getAdminUser("USR_customer")).toMatchObject({
		name: null, phone: null, address: null,
	});
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
