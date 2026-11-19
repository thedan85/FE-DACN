import type { ReactNode } from "react";

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { clearSession, setAccessToken } from "@/features/auth/session";
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
	clearSession();
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

it("attributeDelete403_showsTheSharedPermissionMessage", async () => {
	stubFetch(
		page([colorAttribute]),
		page([blueValue]),
		{
			status: 403,
			body: { code: 403, message: "Access denied", data: null },
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

	fireEvent.click(screen.getByRole("button", { name: "Delete Color" }));
	fireEvent.click(screen.getByRole("button", { name: "Delete attribute" }));
	await flush();

	expect(
		screen.getByText("You do not have permission to perform this action."),
	).toBeTruthy();
});

it("valueDelete403_showsTheSharedPermissionMessageInThePane", async () => {
	stubFetch(
		page([colorAttribute]),
		page([blueValue]),
		{
			status: 403,
			body: { code: 403, message: "Access denied", data: null },
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

	expect(
		screen.getByText("You do not have permission to perform this action."),
	).toBeTruthy();
	expect(screen.getByText("Blue")).toBeTruthy();
});

it("valueDelete401_navigatesToLoginWithoutPaneNoise", async () => {
	stubFetch(
		page([colorAttribute]),
		page([blueValue]),
		{
			status: 401,
			body: { code: 401, message: "Unauthorized", data: null },
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

	expect(nav.replace).toHaveBeenCalledWith("/admin/login");
	expect(
		screen.queryByText("You do not have permission to perform this action."),
	).toBeNull();
	expect(
		screen.queryByText("Your session was refreshed. Please try again."),
	).toBeNull();
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

it("Escape in Add attribute returns focus to the header button", async () => {
	stubFetch(page([colorAttribute]));

	render(
		<App>
			<AttributeDictionaryView />
		</App>,
	);
	await flush();

	const add = screen.getByRole("button", { name: /add attribute/i });
	add.focus();
	fireEvent.click(add);
	await flush();
	expect(screen.getByRole("dialog")).toBeTruthy();

	screen.getByLabelText("Name").focus();
	fireEvent.keyDown(document, { key: "Escape" });

	await waitFor(() => {
		expect(screen.queryByRole("dialog")).toBeNull();
	});
	await waitFor(() => {
		expect(document.activeElement).toBe(add);
	});
});

it("Escape in Edit attribute returns focus to the row trigger", async () => {
	stubFetch(page([colorAttribute]));

	render(
		<App>
			<AttributeDictionaryView />
		</App>,
	);
	await flush();

	const trigger = screen.getByRole("button", { name: "Edit Color" });
	trigger.focus();
	fireEvent.click(trigger);
	await flush();
	expect(screen.getByRole("dialog")).toBeTruthy();

	screen.getByLabelText("Name").focus();
	fireEvent.keyDown(document, { key: "Escape" });

	await waitFor(() => {
		expect(screen.queryByRole("dialog")).toBeNull();
	});
	await waitFor(() => {
		expect(document.activeElement).toBe(trigger);
	});
});

it("Escape in Add value from the empty state returns focus to it", async () => {
	// Two "Add value" buttons render once a selection is made (card header
	// extra and the empty-state action); target the empty-state one.
	stubFetch(page([colorAttribute]), page([]));

	render(
		<App>
			<AttributeDictionaryView />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Color" }));
	await flush();

	const status = screen.getAllByRole("status").at(-1) as HTMLElement;
	const add = within(status).getByRole("button", { name: "Add value" });
	add.focus();
	fireEvent.click(add);
	await flush();
	expect(screen.getByRole("dialog")).toBeTruthy();

	screen.getByLabelText("Value").focus();
	fireEvent.keyDown(document, { key: "Escape" });

	await waitFor(() => {
		expect(screen.queryByRole("dialog")).toBeNull();
	});
	await waitFor(() => {
		expect(document.activeElement).toBe(add);
	});
});

it("Escape in Edit value returns focus to the row trigger", async () => {
	stubFetch(page([colorAttribute]), page([blueValue]));

	render(
		<App>
			<AttributeDictionaryView />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Color" }));
	await flush();

	const trigger = screen.getByRole("button", { name: "Edit value Blue" });
	trigger.focus();
	fireEvent.click(trigger);
	await flush();
	expect(screen.getByRole("dialog")).toBeTruthy();

	screen.getByLabelText("Value").focus();
	fireEvent.keyDown(document, { key: "Escape" });

	await waitFor(() => {
		expect(screen.queryByRole("dialog")).toBeNull();
	});
	await waitFor(() => {
		expect(document.activeElement).toBe(trigger);
	});
});

it("attribute name filter is local, case-insensitive and keeps the selection", async () => {
	const fetch = stubFetch(
		page([colorAttribute, sizeAttribute]),
		page([blueValue]),
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
	const callsAfterSelection = fetch.mock.calls.length;

	fireEvent.change(screen.getByLabelText("Filter attributes by name"), {
		target: { value: "  SIZE " },
	});
	await flush();

	const attributeTable = screen.getAllByRole("table")[0];
	expect(within(attributeTable).getByText("Size")).toBeTruthy();
	expect(within(attributeTable).queryByText("Color")).toBeNull();
	// The hidden attribute stays selected; its values pane is untouched.
	expect(screen.getByText("Values of Color")).toBeTruthy();
	expect(screen.getByText("Blue")).toBeTruthy();
	// Filtering never fetches.
	expect(fetch.mock.calls.length).toBe(callsAfterSelection);
});

it("value filter is local and keeps the edit target on the real value", async () => {
	const redValue = {
		...blueValue,
		attributeValueId: "color-red",
		value: "Red",
	};
	const greenValue = {
		...blueValue,
		attributeValueId: "color-green",
		value: "Green",
	};
	const fetch = stubFetch(
		page([colorAttribute]),
		page([blueValue, redValue, greenValue]),
	);

	render(
		<App>
			<AttributeDictionaryView />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Color" }));
	await flush();
	const callsAfterSelection = fetch.mock.calls.length;

	fireEvent.change(screen.getByLabelText("Filter values by text"), {
		target: { value: "  RED " },
	});
	await flush();

	const valueTable = screen.getAllByRole("table")[1];
	expect(within(valueTable).getByText("Red")).toBeTruthy();
	expect(within(valueTable).queryByText("Blue")).toBeNull();
	expect(fetch.mock.calls.length).toBe(callsAfterSelection);

	// The filtered row still edits the real value, not a filtered index.
	fireEvent.click(screen.getByRole("button", { name: "Edit value Red" }));
	expect((screen.getByLabelText("Value") as HTMLInputElement).value).toBe("Red");
});

it("no-match filters are distinct from empty catalogs", async () => {
	stubFetch(page([colorAttribute]), page([blueValue]));

	render(
		<App>
			<AttributeDictionaryView />
		</App>,
	);
	await flush();

	fireEvent.change(screen.getByLabelText("Filter attributes by name"), {
		target: { value: "zzz" },
	});
	await flush();
	expect(screen.getByText("No attributes match your filter")).toBeTruthy();
	expect(screen.queryByText("No attributes yet")).toBeNull();

	fireEvent.click(screen.getByRole("button", { name: "Clear attribute filter" }));
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Color" }));
	await flush();
	fireEvent.change(screen.getByLabelText("Filter values by text"), {
		target: { value: "zzz" },
	});
	await flush();
	expect(screen.getByText("No values match your filter")).toBeTruthy();
	expect(screen.queryByText("No values yet")).toBeNull();
});

it("recovered 401 on the values read clears stale values and offers a manual retry", async () => {
	setAccessToken("rehydrated-token");
	const revalidate = deferred<void>();
	vi.mocked(useAuthStore.getState().revalidate).mockReturnValue(
		revalidate.promise,
	);
	const secondValuesGet = deferred<Response>();
	let valuesGetCount = 0;
	let deleteCount = 0;
	const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (init?.method === "DELETE") {
			deleteCount += 1;
			return Promise.resolve(jsonResponse(ok(null).body));
		}
		if (url.includes("/attributes?")) {
			return Promise.resolve(jsonResponse(page([colorAttribute]).body));
		}
		if (url.includes("/values")) {
			valuesGetCount += 1;
			if (valuesGetCount === 2) {
				return secondValuesGet.promise;
			}
			return Promise.resolve(jsonResponse(page([blueValue]).body));
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

	fireEvent.click(screen.getByRole("button", { name: "Color" }));
	await flush();
	expect(screen.getByText("Blue")).toBeTruthy();

	// A successful delete triggers a values reload; that read is refused 401.
	fireEvent.click(screen.getByRole("button", { name: "Delete value Blue" }));
	fireEvent.click(screen.getByRole("button", { name: "Delete value" }));
	await flush();

	await act(async () => {
		secondValuesGet.resolve(
			jsonResponse({ code: 401, message: "Unauthorized", data: null }, 401),
		);
	});
	await flush();

	// Stale values are gone while the session is rechecked.
	expect(screen.queryByText("Blue")).toBeNull();

	await act(async () => {
		revalidate.resolve();
	});
	await flush();

	expect(screen.getByText("We couldn't load values")).toBeTruthy();
	expect(screen.getByText(/Your session was refreshed/)).toBeTruthy();
	// No automatic re-read and no replay of the delete.
	expect(valuesGetCount).toBe(2);
	expect(deleteCount).toBe(1);

	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	await flush();
	expect(valuesGetCount).toBe(3);
	expect(screen.getByText("Blue")).toBeTruthy();
});
