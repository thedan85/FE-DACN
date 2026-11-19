import { afterEach, expect, it, vi } from "vitest";

import {
	createCategory,
	deleteCategory,
	listAdminCategories,
	moveCategoryToRoot,
	patchCategory,
} from "./categories.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

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

function ok(data: unknown) {
	return { body: { code: 200, message: "OK", data } };
}

function categoryPage(
	content: unknown[],
	page: number,
	totalPages: number,
	totalElements = content.length,
) {
	return ok({ content, page, size: 100, totalElements, totalPages });
}

const root = {
	categoryId: "ROOT",
	name: "Root category",
	slug: "root-category",
	parentCategoryId: null,
	deleted: false,
	createdAt: "2026-11-01T00:00:00Z",
	updatedAt: "2026-11-01T00:00:00Z",
};

const child = {
	categoryId: "CHILD",
	name: "Child category",
	slug: "child-category",
	parentCategoryId: "ROOT",
	deleted: false,
	createdAt: "2026-11-02T00:00:00Z",
	updatedAt: "2026-11-02T00:00:00Z",
};

it("reads every page of the admin category list", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const pageZero = { ...root, name: "Zeta root" };
	const pageOne = { ...child, name: "Alpha child" };
	const fetch = stubFetch(
		categoryPage([pageZero], 0, 2, 2),
		categoryPage([pageOne], 1, 2, 2),
	);

	const categories = await listAdminCategories();

	expect(categories.map((entry) => entry.categoryId)).toEqual([
		"ROOT",
		"CHILD",
	]);
	const pages = fetch.mock.calls.map(([url]) =>
		new URL(String(url)).searchParams.get("page"),
	);
	expect(pages).toEqual(["0", "1"]);
	expect(
		fetch.mock.calls.every(
			([url]) => new URL(String(url)).searchParams.get("size") === "100",
		),
	).toBe(true);
});

it("moveCategoryToRoot sends one PUT with parentCategoryId null", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok({ ...child, parentCategoryId: null }));

	await moveCategoryToRoot("CHILD");

	expect(fetch).toHaveBeenCalledTimes(1);
	const [url, init] = fetch.mock.calls[0];
	expect(init.method).toBe("PUT");
	expect(new URL(String(url)).pathname).toBe("/api/v1/categories/CHILD");
	expect(JSON.parse(String(init.body))).toEqual({ parentCategoryId: null });
});

it("renaming alone uses PATCH without parentCategoryId", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok({ ...child, name: "Renamed child" }));

	await patchCategory("CHILD", { name: "Renamed child" });

	expect(fetch).toHaveBeenCalledTimes(1);
	const [url, init] = fetch.mock.calls[0];
	expect(init.method).toBe("PATCH");
	expect(new URL(String(url)).pathname).toBe("/api/v1/categories/CHILD");
	expect(JSON.parse(String(init.body))).toEqual({ name: "Renamed child" });
	expect(JSON.parse(String(init.body))).not.toHaveProperty("parentCategoryId");
});

it("createCategory posts name, slug and the optional parent", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok({ ...child, categoryId: "NEW_CAT" }));

	await createCategory({
		name: "Freshwater fish",
		slug: "freshwater-fish",
		parentCategoryId: "ROOT",
	});

	const [url, init] = fetch.mock.calls[0];
	expect(init.method).toBe("POST");
	expect(new URL(String(url)).pathname).toBe("/api/v1/categories");
	expect(JSON.parse(String(init.body))).toEqual({
		name: "Freshwater fish",
		slug: "freshwater-fish",
		parentCategoryId: "ROOT",
	});
});

it("deleteCategory sends DELETE and accepts the null-data envelope", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok(null));

	await deleteCategory("CHILD");

	const [url, init] = fetch.mock.calls[0];
	expect(init.method).toBe("DELETE");
	expect(new URL(String(url)).pathname).toBe("/api/v1/categories/CHILD");
});

it("a duplicate slug surfaces the server's 409 message", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch({
		status: 409,
		body: {
			code: 409,
			message: "duplicate key value violates unique constraint",
			data: null,
		},
	});

	let caught: unknown;
	try {
		await createCategory({ name: "Livestock", slug: "livestock" });
	} catch (error) {
		caught = error;
	}

	expect(fetch).toHaveBeenCalledTimes(1);
	expect(caught).toMatchObject({
		status: 409,
		message: "duplicate key value violates unique constraint",
	});
});
