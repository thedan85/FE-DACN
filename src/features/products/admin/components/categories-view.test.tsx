import type { ReactNode } from "react";

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";

import { CategoriesView } from "./categories-view";

const nav = vi.hoisted(() => {
	const replace = vi.fn();
	return { replace, router: { replace } };
});

vi.mock("next/navigation", () => ({
	useRouter: () => nav.router,
	usePathname: () => "/admin/categories",
}));

vi.mock(
	"@/features/products/admin/components/admin-catalog-theme",
	() => ({
		AdminCatalogTheme: ({ children }: { children: ReactNode }) => (
			<div data-testid="admin-catalog-theme">{children}</div>
		),
	}),
);

const adminUser = {
	userId: "USR_ADMIN",
	email: "admin@example.com",
	name: "Admin Actor",
	phone: "0900000001",
	address: null,
	roleCode: "admin",
	roleName: "Administrator",
	permissions: ["category:create", "category:update", "category:delete"],
	hasPassword: true,
};

const rootCategory = {
	categoryId: "ROOT",
	name: "Reef tanks",
	slug: "reef-tanks",
	parentCategoryId: null,
	deleted: false,
	createdAt: "2026-11-01T00:00:00Z",
	updatedAt: "2026-11-01T00:00:00Z",
};

const childCategory = {
	categoryId: "CHILD",
	name: "Coral",
	slug: "coral",
	parentCategoryId: "ROOT",
	deleted: false,
	createdAt: "2026-11-02T00:00:00Z",
	updatedAt: "2026-11-02T00:00:00Z",
};

const orphanCategory = {
	categoryId: "ORPHAN",
	name: "Orphaned leaf",
	slug: "orphaned-leaf",
	parentCategoryId: "GHOST",
	deleted: false,
	createdAt: "2026-11-03T00:00:00Z",
	updatedAt: "2026-11-03T00:00:00Z",
};

function ok(data: unknown) {
	return { body: { code: 200, message: "OK", data } };
}

function page(
	content: unknown[],
	pageNumber = 0,
	totalPages = 1,
	totalElements = content.length,
) {
	return ok({
		content,
		page: pageNumber,
		size: 100,
		totalElements,
		totalPages,
	});
}

function stubFetch(...responses: { status?: number; body: unknown }[]) {
	const fetch = vi.fn();
	for (const response of responses) {
		fetch.mockResolvedValueOnce(
			new Response(JSON.stringify(response.body), {
				status: response.status ?? 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
	}
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

async function flush() {
	await act(async () => {
		await Promise.resolve();
	});
}

beforeEach(() => {
	nav.replace.mockReset();
	useAuthStore.setState({ status: "authenticated", user: adminUser });
	vi.spyOn(useAuthStore.getState(), "revalidate").mockResolvedValue(undefined);
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
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

it("reads both pages before the hierarchy is shown", async () => {
	const fetch = stubFetch(
		page([rootCategory], 0, 2, 2),
		page([childCategory], 1, 2, 2),
	);

	render(
		<App>
			<CategoriesView />
		</App>,
	);
	await flush();

	expect(fetch).toHaveBeenCalledTimes(2);
	const pages = fetch.mock.calls.map(([url]) =>
		new URL(String(url)).searchParams.get("page"),
	);
	expect(pages).toEqual(["0", "1"]);
	expect(screen.getAllByText("Reef tanks").length).toBeGreaterThan(0);
	expect(screen.getByText("Coral")).toBeTruthy();
});

it("keeps a row whose parent is absent from the result visible", async () => {
	stubFetch(page([orphanCategory]));

	render(
		<App>
			<CategoriesView />
		</App>,
	);
	await flush();

	expect(screen.getByText("Orphaned leaf")).toBeTruthy();
});

it("does not offer to delete a category that has a child", async () => {
	const fetch = stubFetch(page([rootCategory, childCategory]));

	render(
		<App>
			<CategoriesView />
		</App>,
	);
	await flush();

	// The parent name also renders in the child's Parent cell, so locate the
	// rows through their unique action buttons.
	const parentDelete = screen.getByRole("button", {
		name: "Delete Reef tanks",
	}) as HTMLButtonElement;
	const childDelete = screen.getByRole("button", {
		name: "Delete Coral",
	}) as HTMLButtonElement;
	expect(parentDelete.closest("tr")).not.toBeNull();

	expect(parentDelete.disabled).toBe(true);
	expect(childDelete.disabled).toBe(false);

	fireEvent.click(parentDelete);
	await flush();

	expect(
		fetch.mock.calls.some(([, init]) => (init as RequestInit)?.method === "DELETE"),
	).toBe(false);
});

it("duplicate slug keeps the create form open", async () => {
	stubFetch(
		page([rootCategory]),
		{
			status: 409,
			body: {
				code: 409,
				message: "duplicate key value violates unique constraint",
				data: null,
			},
		},
	);

	render(
		<App>
			<CategoriesView />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /add category/i }));
	fireEvent.change(screen.getByLabelText("Name"), {
		target: { value: "Livestock" },
	});
	fireEvent.change(screen.getByLabelText("Slug"), {
		target: { value: "reef-tanks" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save category" }));

	// antd renders the field-error row on the next frame after the store
	// updates, so the message is awaited rather than read synchronously.
	await waitFor(() => {
		expect(
			screen.getByText("duplicate key value violates unique constraint"),
		).toBeTruthy();
	});

	// The dialog stays open, carrying the server's reason, and the draft
	// is not thrown away.
	expect(screen.getByRole("dialog")).toBeTruthy();
	expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe(
		"reef-tanks",
	);
});

it("renaming alone submits PATCH without parentCategoryId", async () => {
	const fetch = stubFetch(
		page([rootCategory]),
		ok({ ...rootCategory, name: "Renamed root" }),
		page([{ ...rootCategory, name: "Renamed root" }]),
	);

	render(
		<App>
			<CategoriesView />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Edit Reef tanks" }));
	fireEvent.change(screen.getByLabelText("Name"), {
		target: { value: "Renamed root" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save category" }));
	await flush();

	const writes = fetch.mock.calls.filter(
		([, init]) => (init as RequestInit)?.method === "PATCH" ||
			(init as RequestInit)?.method === "PUT" ||
			(init as RequestInit)?.method === "POST",
	);
	expect(writes).toHaveLength(1);
	const [, init] = writes[0];
	expect((init as RequestInit).method).toBe("PATCH");
	expect(JSON.parse(String((init as RequestInit).body))).toEqual({
		name: "Renamed root",
	});
});

it("moving a category to the root submits one PUT with parentCategoryId null", async () => {
	const fetch = stubFetch(
		page([rootCategory, childCategory]),
		ok({ ...childCategory, parentCategoryId: null }),
		page([rootCategory, { ...childCategory, parentCategoryId: null }]),
	);

	render(
		<App>
			<CategoriesView />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Edit Coral" }));
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Parent category" }));
	fireEvent.click(await screen.findByText("No parent (root)"));
	fireEvent.click(screen.getByRole("button", { name: "Save category" }));
	await flush();

	const writes = fetch.mock.calls.filter(([, init]) =>
		["PUT", "PATCH", "POST"].includes(
			String((init as RequestInit)?.method),
		),
	);
	expect(writes).toHaveLength(1);
	const [url, init] = writes[0];
	expect((init as RequestInit).method).toBe("PUT");
	expect(new URL(String(url)).pathname).toBe("/api/v1/categories/CHILD");
	expect(JSON.parse(String((init as RequestInit).body))).toEqual({
		parentCategoryId: null,
	});
});

it("a successful delete reloads the list", async () => {
	const fetch = stubFetch(
		page([rootCategory, childCategory]),
		ok(null),
		page([rootCategory]),
	);

	render(
		<App>
			<CategoriesView />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Delete Coral" }));
	fireEvent.click(screen.getByRole("button", { name: "Delete category" }));
	await flush();

	const deletes = fetch.mock.calls.filter(
		([, init]) => (init as RequestInit)?.method === "DELETE",
	);
	expect(deletes).toHaveLength(1);
	expect(new URL(String(deletes[0][0])).pathname).toBe(
		"/api/v1/categories/CHILD",
	);
	// Mount read + the reload after the mutation.
	expect(fetch).toHaveBeenCalledTimes(3);
});

it("hides the write actions without their permissions but still lists", async () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...adminUser, permissions: [] },
	});
	stubFetch(page([rootCategory, childCategory]));

	render(
		<App>
			<CategoriesView />
		</App>,
	);
	await flush();

	expect(screen.getAllByText("Reef tanks").length).toBeGreaterThan(0);
	expect(
		screen.queryByRole("button", { name: /add category/i }),
	).toBeNull();
	expect(screen.queryByRole("button", { name: "Edit Reef tanks" })).toBeNull();
	expect(
		screen.queryByRole("button", { name: "Delete Reef tanks" }),
	).toBeNull();
});

it("shows the error surface with a retry when the list read fails", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockRejectedValue(new Error("connection reset")),
	);

	render(
		<App>
			<CategoriesView />
		</App>,
	);
	await flush();

	expect(screen.getByText("We couldn't load categories")).toBeTruthy();
	expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});
