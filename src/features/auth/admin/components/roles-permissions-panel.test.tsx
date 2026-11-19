import type { ReactNode } from "react";

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";

import { RolesPermissionsPanel } from "./roles-permissions-panel";

const nav = vi.hoisted(() => {
	const replace = vi.fn();
	// A module-level instance: a fresh object per call would re-fire effects
	// that list the router as a dependency.
	return { search: "", replace, router: { replace } };
});

vi.mock("next/navigation", () => ({
	useRouter: () => nav.router,
	usePathname: () => "/admin/staff",
	useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("@/features/products/admin/components/admin-catalog-theme", () => ({
	AdminCatalogTheme: ({ children }: { children: ReactNode }) => (
		<div data-testid="admin-catalog-theme">{children}</div>
	),
}));

const timestamp = "2026-11-09T14:21:33.000000Z";

// PERM_* values are synthetic opaque fixtures for these tests. Real seeded
// permission IDs are UUIDs; the API treats the IDs as opaque either way.
const categoryRead = {
	permissionId: "PERM_category-read",
	code: "category:read",
	name: "Read Category",
	resource: "category",
	action: "read",
	description: null,
	createdAt: timestamp,
	updatedAt: timestamp,
};

const orderRead = {
	...categoryRead,
	permissionId: "PERM_order-read",
	code: "order:read",
	name: "Read Order",
	resource: "order",
};

const productCreate = {
	...categoryRead,
	permissionId: "PERM_product-create",
	code: "product:create",
	name: "Create Product",
	resource: "product",
	action: "create",
};

const roleRead = {
	...categoryRead,
	permissionId: "PERM_role-read",
	code: "role:read",
	name: "Read Role",
	resource: "role",
};

const userRead = {
	...categoryRead,
	permissionId: "PERM_user-read",
	code: "user:read",
	name: "Read User",
	resource: "user",
};

const ALL_PERMISSIONS = [
	categoryRead,
	orderRead,
	productCreate,
	roleRead,
	userRead,
];

const ADMIN = {
	roleId: "ROLE_admin",
	code: "admin",
	name: "Administrator",
	description: null,
	system: true,
	createdAt: timestamp,
	updatedAt: timestamp,
};
const CUSTOMER = {
	roleId: "ROLE_customer",
	code: "customer",
	name: "Customer",
	description: null,
	system: true,
	createdAt: timestamp,
	updatedAt: timestamp,
};
const EMPLOYEE = {
	roleId: "ROLE_employee",
	code: "employee",
	name: "Employee",
	description: null,
	system: true,
	createdAt: timestamp,
	updatedAt: timestamp,
};
const SUPPORT = {
	roleId: "ROLE_support",
	code: "support",
	name: "Support",
	description: "Support role",
	system: false,
	createdAt: timestamp,
	updatedAt: timestamp,
};

let details: Record<string, Record<string, unknown>>;

interface RoleSummaryFixture {
	roleId: string;
	code: string;
	name: string;
	description: string | null;
	system: boolean;
	createdAt: string;
	updatedAt: string;
}

let roleFixtures: RoleSummaryFixture[];
let putOverride: ((roleId: string, ids: string[]) => Response) | null;
let postOverride: ((body: Record<string, unknown>) => Response) | null;
let deleteOverride: ((roleId: string) => Response) | null;

function makeResponse(status: number, payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function resetFixtures() {
	roleFixtures = [ADMIN, CUSTOMER, EMPLOYEE, SUPPORT].map((role) => ({
		...role,
	}));
	details = {
		ROLE_admin: {
			...ADMIN,
			permissions: [productCreate, roleRead, userRead],
		},
		ROLE_customer: { ...CUSTOMER, permissions: [] },
		ROLE_employee: { ...EMPLOYEE, permissions: [userRead] },
		ROLE_support: { ...SUPPORT, permissions: [productCreate] },
	};
	putOverride = null;
	postOverride = null;
	deleteOverride = null;
}

function installFetchStub() {
	const fetchMock = vi.fn(
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(String(input));
			const method = (init?.method ?? "GET").toUpperCase();
			const path = url.pathname.replace(/^\/api\/v1/, "");

			if (path === "/admin/roles" && method === "GET") {
				return makeResponse(200, {
					code: 200,
					message: "OK",
					data: roleFixtures,
				});
			}

			if (path === "/admin/permissions" && method === "GET") {
				return makeResponse(200, {
					code: 200,
					message: "OK",
					data: ALL_PERMISSIONS,
				});
			}

			if (path === "/admin/roles" && method === "POST") {
				const body = JSON.parse(String(init?.body)) as {
					code: string;
					name: string;
					description?: string;
				};
				if (postOverride) {
					return postOverride(body);
				}

				const created = {
					roleId: `ROLE_${body.code.toLowerCase().replace(/_/g, "-")}`,
					code: body.code.toLowerCase(),
					name: body.name,
					description: body.description ?? null,
					system: false,
					createdAt: timestamp,
					updatedAt: timestamp,
					permissions: [] as unknown[],
				};
				const summary: RoleSummaryFixture = {
					roleId: created.roleId,
					code: created.code,
					name: created.name,
					description: created.description,
					system: created.system,
					createdAt: created.createdAt,
					updatedAt: created.updatedAt,
				};
				roleFixtures = [...roleFixtures, summary];
				details[created.roleId] = created;

				return makeResponse(201, {
					code: 201,
					message: "Created",
					data: created,
				});
			}

			const grantMatch = path.match(/^\/admin\/roles\/([^/]+)\/permissions$/);
			if (grantMatch && method === "PUT") {
				const roleId = decodeURIComponent(grantMatch[1]);
				const body = JSON.parse(String(init?.body)) as {
					permissionIds: string[];
				};
				if (putOverride) {
					return putOverride(roleId, body.permissionIds);
				}

				const granted = ALL_PERMISSIONS.filter((permission) =>
					body.permissionIds.includes(permission.permissionId),
				).sort((left, right) => left.code.localeCompare(right.code));

				return makeResponse(200, {
					code: 200,
					message: "OK",
					data: { ...details[roleId], permissions: granted },
				});
			}

			const roleMatch = path.match(/^\/admin\/roles\/([^/]+)$/);
			if (roleMatch) {
				const roleId = decodeURIComponent(roleMatch[1]);

				if (method === "GET") {
					const detail = details[roleId];
					return detail
						? makeResponse(200, { code: 200, message: "OK", data: detail })
						: makeResponse(404, {
								code: 404,
								message: `role not found: ${roleId}`,
								data: null,
							});
				}

				if (method === "PATCH") {
					const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
					const base = details[roleId];
					return makeResponse(200, {
						code: 200,
						message: "OK",
						data: { ...base, ...body },
					});
				}

				if (method === "DELETE") {
					if (deleteOverride) {
						return deleteOverride(roleId);
					}

					roleFixtures = roleFixtures.filter((role) => role.roleId !== roleId);
					delete details[roleId];

					return makeResponse(200, {
						code: 200,
						message: "OK",
						data: null,
					});
				}
			}

			throw new Error(`Unexpected fetch in test: ${method} ${path}`);
		},
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function putCallBodies(fetchMock: ReturnType<typeof installFetchStub>) {
	return fetchMock.mock.calls
		.filter(([input, init]) => {
			const path = new URL(String(input)).pathname;
			return path.endsWith("/permissions") && init?.method === "PUT";
		})
		.map(([, init]) => JSON.parse(String(init?.body)) as unknown);
}

async function flush() {
	await act(async () => {
		await Promise.resolve();
	});
}

function renderPanel() {
	return render(
		<App>
			<RolesPermissionsPanel />
		</App>,
	);
}

async function selectRole(name: string) {
	fireEvent.click(
		screen.getByRole("button", { name: new RegExp(`^${name}\\b`) }),
	);
	await flush();
}

const actor = {
	userId: "USR_ADMIN",
	email: "admin@example.com",
	name: "Admin Actor",
	phone: null,
	address: null,
	roleCode: "admin",
	roleName: "Administrator",
	permissions: ["role:read", "role:update", "role:create", "role:delete"],
	hasPassword: true,
};

beforeEach(() => {
	nav.search = "";
	nav.replace.mockReset();
	resetFixtures();
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	useAuthStore.setState({ status: "authenticated", user: actor });
	// antd's responsive pieces read these; jsdom provides neither.
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockReturnValue({
			matches: false,
			addListener() {},
			removeListener() {},
			addEventListener() {},
			removeEventListener() {},
		}),
	);
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

it("replaceGrants_preservesOtherGroups", async () => {
	const fetchMock = installFetchStub();
	const revalidate = vi
		.spyOn(useAuthStore.getState(), "revalidate")
		.mockResolvedValue(undefined);

	renderPanel();
	await flush();

	// The custom support role keeps its product grant while order:read joins it.
	await selectRole("Support");

	fireEvent.click(
		screen.getByRole("checkbox", { name: /order:read/i }),
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Save permission changes" }),
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Save permissions" }),
	);
	await flush();

	expect(putCallBodies(fetchMock)).toEqual([
		{ permissionIds: ["PERM_order-read", "PERM_product-create"] },
	]);
	expect(revalidate).toHaveBeenCalled();
});

it("clearedCustomRole_sendsEmptyArray", async () => {
	const fetchMock = installFetchStub();
	vi.spyOn(useAuthStore.getState(), "revalidate").mockResolvedValue(undefined);

	renderPanel();
	await flush();
	await selectRole("Support");

	// Unchecking the only remaining grant clears the custom role.
	fireEvent.click(
		screen.getByRole("checkbox", { name: /product:create/i }),
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Save permission changes" }),
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Save permissions" }),
	);
	await flush();

	expect(putCallBodies(fetchMock)).toEqual([{ permissionIds: [] }]);
});

it("adminRole_requiredGrantsCannotBeUnchecked", async () => {
	installFetchStub();
	renderPanel();
	await flush();

	// The admin role is selected by default (system roles list first).
	const userReadBox = screen.getByRole("checkbox", {
		name: /user:read/i,
	}) as HTMLInputElement;
	const roleReadBox = screen.getByRole("checkbox", {
		name: /role:read/i,
	}) as HTMLInputElement;

	expect(userReadBox.checked).toBe(true);
	expect(userReadBox.disabled).toBe(true);
	expect(roleReadBox.checked).toBe(true);
	expect(roleReadBox.disabled).toBe(true);
});

it("adminRole_canRegrantDriftedProtectedGrantButCannotRemoveHeldOne", async () => {
	const fetchMock = installFetchStub();
	vi.spyOn(useAuthStore.getState(), "revalidate").mockResolvedValue(undefined);
	// Drift: the admin role lost role:read in storage.
	details.ROLE_admin = {
		...details.ROLE_admin,
		permissions: [productCreate, userRead],
	};

	renderPanel();
	await flush();

	const roleReadBox = screen.getByRole("checkbox", {
		name: /role:read/i,
	}) as HTMLInputElement;
	const userReadBox = screen.getByRole("checkbox", {
		name: /user:read/i,
	}) as HTMLInputElement;

	// A protected grant the admin does NOT hold can be re-added…
	expect(roleReadBox.checked).toBe(false);
	expect(roleReadBox.disabled).toBe(false);
	fireEvent.click(roleReadBox);
	expect(roleReadBox.checked).toBe(true);

	// …while a held protected grant cannot be unchecked.
	expect(userReadBox.checked).toBe(true);
	expect(userReadBox.disabled).toBe(true);
	fireEvent.click(userReadBox);
	expect(userReadBox.checked).toBe(true);

	fireEvent.click(
		screen.getByRole("button", { name: "Save permission changes" }),
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Save permissions" }),
	);
	await flush();

	// The payload carries the re-added grant and keeps the held one.
	expect(putCallBodies(fetchMock)).toEqual([
		{
			permissionIds: [
				"PERM_product-create",
				"PERM_role-read",
				"PERM_user-read",
			],
		},
	]);
});

it("systemRole_cannotBeDeleted", async () => {
	const fetchMock = installFetchStub();
	renderPanel();
	await flush();

	expect(
		screen.queryByRole("button", { name: "Delete Administrator" }),
	).toBeNull();
	expect(
		screen.queryByRole("button", { name: "Delete Customer" }),
	).toBeNull();
	expect(
		screen.queryByRole("button", { name: "Delete Employee" }),
	).toBeNull();
	expect(
		screen.getByRole("button", { name: "Delete Support" }),
	).toBeTruthy();
	expect(
		fetchMock.mock.calls.some(
			([, init]) => init?.method === "DELETE",
		),
	).toBe(false);
});

it("customerRole_hasNoEditActions", async () => {
	installFetchStub();
	renderPanel();
	await flush();
	await selectRole("Customer");

	expect(screen.getByText(/customer role/i)).toBeTruthy();
	expect(
		screen.queryByRole("button", { name: /^save/i }),
	).toBeNull();
	expect(
		screen.queryByRole("button", { name: "Delete Customer" }),
	).toBeNull();
	for (const checkbox of screen.getAllByRole("checkbox")) {
		expect((checkbox as HTMLInputElement).disabled).toBe(true);
	}
});

it("conflict409_keepsGrantDraft", async () => {
	const fetchMock = installFetchStub();
	putOverride = () =>
		makeResponse(409, {
			code: 409,
			message: "The admin role must keep every user and role permission",
			data: null,
		});

	renderPanel();
	await flush();

	// Admin is selected by default; check an editable permission to go dirty.
	fireEvent.click(
		screen.getByRole("checkbox", { name: /category:read/i }),
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Save permission changes" }),
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Save permissions" }),
	);
	await flush();

	expect(
		screen.getByText(
			"The admin role must keep every user and role permission",
		),
	).toBeTruthy();
	expect(putCallBodies(fetchMock)).toHaveLength(1);
	// The draft is not reset: the just-checked permission stays checked.
	expect(
		(screen.getByRole("checkbox", {
			name: /category:read/i,
		}) as HTMLInputElement).checked,
	).toBe(true);
});

it("grantSave_requiresConfirmation", async () => {
	const fetchMock = installFetchStub();
	renderPanel();
	await flush();
	await selectRole("Support");

	fireEvent.click(
		screen.getByRole("checkbox", { name: /order:read/i }),
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Save permission changes" }),
	);
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	await flush();

	expect(putCallBodies(fetchMock)).toEqual([]);
});

it("createRole_conflict409_keepsFormValues", async () => {
	installFetchStub();
	postOverride = () =>
		makeResponse(409, {
			code: 409,
			message: "Role code already exists",
			data: null,
		});

	renderPanel();
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "New role" }));
	fireEvent.change(screen.getByLabelText("Code"), {
		target: { value: "AUDITOR_NEW" },
	});
	fireEvent.change(screen.getByLabelText("Name"), {
		target: { value: "Auditor New" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Create role" }));
	await flush();

	expect(screen.getByText("Role code already exists")).toBeTruthy();
	expect((screen.getByLabelText("Code") as HTMLInputElement).value).toBe(
		"AUDITOR_NEW",
	);

	// Retrying against a healthy backend succeeds and refreshes the list.
	postOverride = null;
	fireEvent.click(screen.getByRole("button", { name: "Create role" }));
	await flush();

	expect(screen.queryByLabelText("Code")).toBeNull();
	expect(screen.getAllByText(/auditor_new/i).length).toBeGreaterThan(0);
});

it("createRole_rejectsInvalidCodeWithoutCallingTheApi", async () => {
	const fetchMock = installFetchStub();
	renderPanel();
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "New role" }));
	fireEvent.change(screen.getByLabelText("Code"), {
		target: { value: "1bad" },
	});
	fireEvent.change(screen.getByLabelText("Name"), {
		target: { value: "Bad Code" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Create role" }));
	await flush();

	expect(
		fetchMock.mock.calls.some(
			([, init]) => init?.method === "POST",
		),
	).toBe(false);
});

it("deleteRole_conflict409_keepsRoleInList", async () => {
	installFetchStub();
	deleteOverride = () =>
		makeResponse(409, {
			code: 409,
			message: "Role is assigned to a user and cannot be deleted",
			data: null,
		});

	renderPanel();
	await flush();
	await selectRole("Support");

	fireEvent.click(screen.getByRole("button", { name: "Delete Support" }));
	fireEvent.click(screen.getByRole("button", { name: "Delete" }));
	await flush();

	expect(
		screen.getByText("Role is assigned to a user and cannot be deleted"),
	).toBeTruthy();
	expect(
		screen.getByRole("button", { name: /^Support\b/ }),
	).toBeTruthy();
});
