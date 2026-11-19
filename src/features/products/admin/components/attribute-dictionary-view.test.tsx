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

import { AttributeDictionaryView } from "./attribute-dictionary-view";

const nav = vi.hoisted(() => {
	const replace = vi.fn();
	return { replace, router: { replace } };
});

vi.mock("next/navigation", () => ({
	useRouter: () => nav.router,
	usePathname: () => "/admin/attributes",
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
	permissions: ["attribute:create", "attribute:update", "attribute:delete"],
	hasPassword: true,
};

const colorAttribute = {
	attributeId: "color",
	name: "Color",
	deleted: false,
	createdAt: "2026-11-01T00:00:00Z",
	updatedAt: "2026-11-01T00:00:00Z",
};

const sizeAttribute = {
	attributeId: "size",
	name: "Size",
	deleted: false,
	createdAt: "2026-11-02T00:00:00Z",
	updatedAt: "2026-11-02T00:00:00Z",
};

const blueValue = {
	attributeValueId: "color-blue",
	attributeId: "color",
	attributeName: "Color",
	value: "Blue",
	createdAt: "2026-11-01T00:00:00Z",
	updatedAt: "2026-11-01T00:00:00Z",
};

const smallValue = {
	attributeValueId: "size-small",
	attributeId: "size",
	attributeName: "Size",
	value: "Small",
	createdAt: "2026-11-02T00:00:00Z",
	updatedAt: "2026-11-02T00:00:00Z",
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

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
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

it("lateAttributeValues_doNotReplaceCurrentSelection", async () => {
	const colorValues = deferred<Response>();
	const sizeValues = deferred<Response>();
	const fetch = vi.fn((input: RequestInfo | URL) => {
		const url = String(input);

		if (url.includes("/attributes/color/values")) {
			return colorValues.promise;
		}

		if (url.includes("/attributes/size/values")) {
			return sizeValues.promise;
		}

		if (url.includes("/attributes?")) {
			return Promise.resolve(
				jsonResponse(page([colorAttribute, sizeAttribute]).body),
			);
		}

		return Promise.reject(new Error(`Unexpected request: ${url}`));
	});
	vi.stubGlobal("fetch", fetch);

	render(
		<App>
			<AttributeDictionaryView />
		</App>,
	);
	await flush();

	// Select Color first, then switch to Size before Color resolves.
	fireEvent.click(screen.getByRole("button", { name: "Color" }));
	fireEvent.click(screen.getByRole("button", { name: "Size" }));

	// The later selection resolves first…
	await act(async () => {
		sizeValues.resolve(jsonResponse(page([smallValue]).body));
	});
	await flush();

	// …and the earlier one arrives afterwards. Its stale response must not
	// replace what the user is now looking at.
	await act(async () => {
		colorValues.resolve(jsonResponse(page([blueValue]).body));
	});
	await flush();

	expect(screen.queryByText("Blue")).toBeNull();
	expect(screen.getByText("Small")).not.toBeNull();
});

it("linkedValueDelete_keepsRowOnConflict", async () => {
	const fetch = stubFetch(
		page([colorAttribute]),
		page([blueValue]),
		{
			status: 409,
			body: {
				code: 409,
				message: "could not execute statement; violates foreign key constraint",
				data: null,
			},
		},
	);

	render(
		<App>
			<AttributeDictionaryView />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Color" }));
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "Delete value Blue" }),
	);
	fireEvent.click(screen.getByRole("button", { name: "Delete value" }));
	await flush();

	// The row stays — a hard delete against a linked value must not make the
	// row vanish — and the pane explains what has to happen first.
	expect(screen.getByText("Blue")).toBeTruthy();
	expect(screen.getByText(/detach/i)).toBeTruthy();
	const deletes = fetch.mock.calls.filter(
		([, init]) => (init as RequestInit)?.method === "DELETE",
	);
	expect(deletes).toHaveLength(1);
	expect(new URL(String(deletes[0][0])).pathname).toBe(
		"/api/v1/attribute-values/color-blue",
	);
});

it("deleting the selected attribute clears the selection", async () => {
	stubFetch(
		page([colorAttribute, sizeAttribute]),
		page([blueValue]),
		ok(null),
		page([sizeAttribute]),
	);

	render(
		<App>
			<AttributeDictionaryView />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Color" }));
	await flush();
	expect(screen.getByText("Blue")).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: "Delete Color" }));
	fireEvent.click(screen.getByRole("button", { name: "Delete attribute" }));
	await flush();

	expect(screen.getByText("No attribute selected")).toBeTruthy();
});

it("hides the write actions without their permissions but still lists", async () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...adminUser, permissions: [] },
	});
	stubFetch(page([colorAttribute]), page([blueValue]));

	render(
		<App>
			<AttributeDictionaryView />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Color" }));
	await flush();

	expect(screen.getAllByText("Color").length).toBeGreaterThan(0);
	expect(screen.getByText("Blue")).toBeTruthy();
	expect(
		screen.queryByRole("button", { name: "Add attribute" }),
	).toBeNull();
	expect(screen.queryByRole("button", { name: "Edit Color" })).toBeNull();
	expect(screen.queryByRole("button", { name: "Delete Color" })).toBeNull();
	expect(screen.queryByRole("button", { name: "Add value" })).toBeNull();
	expect(
		screen.queryByRole("button", { name: "Edit value Blue" }),
	).toBeNull();
	expect(
		screen.queryByRole("button", { name: "Delete value Blue" }),
	).toBeNull();
});

it("shows the error surface with a retry when the list read fails", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockRejectedValue(new Error("connection reset")),
	);

	render(
		<App>
			<AttributeDictionaryView />
		</App>,
	);
	await flush();

	expect(screen.getByText("We couldn't load attributes")).toBeTruthy();
	expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});
