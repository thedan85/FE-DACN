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

import { clearSession, setAccessToken } from "@/features/auth/session";
import { useAuthStore } from "@/stores/auth-store";

import { MediaLibraryView } from "./media-library-view";

const release = vi.hoisted(() => ({ value: false }));

vi.mock("../model/media-library-release", () => ({
	get mediaDeleteEnabled() {
		return release.value;
	},
}));

const nav = vi.hoisted(() => {
	const replace = vi.fn();
	return { replace, router: { replace } };
});

vi.mock("next/navigation", () => ({
	useRouter: () => nav.router,
	usePathname: () => "/admin/media",
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
	permissions: [
		"media:create",
		"media:update",
		"media:delete",
		"product:create",
	],
	hasPassword: true,
};

const cloudinaryUrl =
	"https://res.cloudinary.com/ibk3z2nt/image/upload/v1/sample.png";
const externalUrl = "https://cdn.example.com/pic.jpg";

const productFixture = {
	productId: "PRD_1",
	slug: "reef-tanks",
	name: "Reef tanks",
	description: "Reef tank listings",
	detailDescription: "",
	thumbnail: null,
	thumbnailMediaId: null,
	status: "ACTIVE",
	categoryId: null,
	categoryName: null,
	minPrice: null,
	maxPrice: null,
	stock: 0,
	createdAt: "2026-11-01T00:00:00Z",
	updatedAt: "2026-11-01T00:00:00Z",
};

const mediaRow = (overrides: Record<string, unknown> = {}) => ({
	mediaId: "MED_1",
	url: cloudinaryUrl,
	productId: "PRD_1",
	variantId: null,
	deleted: false,
	createdAt: "2026-11-02T00:00:00Z",
	updatedAt: "2026-11-02T00:00:00Z",
	...overrides,
});

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
		size: 20,
		totalElements,
		totalPages,
	});
}

function productsPage(products: unknown[]) {
	return page(products, 0, 1, products.length);
}

function productDetail() {
	return ok({
		product: productFixture,
		attributes: [],
		variants: [
			{
				variantId: "VAR_1",
				sku: "SKU-1",
				price: 100000,
				stock: 5,
				stockRevision: null,
				attributes: [],
				media: [],
			},
		],
		reviews: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
	});
}

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
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

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

function respond(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function selectedProductLabel() {
	return (
		screen
			.getByRole("combobox", { name: "Product" })
			.closest(".ant-select")
			?.querySelector(".ant-select-content")
			?.getAttribute("title") ?? null
	);
}

beforeEach(() => {
	release.value = false;
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

// Focus-restore round-trips exceed the 15s default on a loaded suite; the
// neighbouring paging test carries the same 20s budget.
it("Escape in Add media returns focus to the header button", { timeout: 20000 }, async () => {
	stubFetch(page([mediaRow()]));

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	const add = screen.getByRole("button", { name: /add media/i });
	add.focus();
	fireEvent.click(add);
	await flush();
	expect(screen.getByRole("dialog")).toBeTruthy();

	screen.getByLabelText("Image URL").focus();
	fireEvent.keyDown(document, { key: "Escape" });

	await waitFor(() => {
		expect(screen.queryByRole("dialog")).toBeNull();
	});
	await waitFor(() => {
		expect(document.activeElement).toBe(add);
	});
});

it("Escape in Edit media returns focus to the row trigger", { timeout: 20000 }, async () => {
	stubFetch(page([mediaRow()]));

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	const trigger = screen.getByRole("button", { name: "Edit media MED_1" });
	trigger.focus();
	fireEvent.click(trigger);
	await flush();
	expect(screen.getByRole("dialog")).toBeTruthy();

	screen.getByLabelText("Image URL").focus();
	fireEvent.keyDown(document, { key: "Escape" });

	await waitFor(() => {
		expect(screen.queryByRole("dialog")).toBeNull();
	});
	await waitFor(() => {
		expect(document.activeElement).toBe(trigger);
	});
});

it("mediaList_showsOneBasedPageAndResetsOnFilterChange", { timeout: 20000 }, async () => {
	const fetch = stubFetch(
		page([mediaRow()], 0, 3, 50),
		page([mediaRow({ mediaId: "MED_2" })], 1, 3, 50),
		productsPage([productFixture]),
		page([mediaRow()], 0, 3, 50),
	);

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	expect(
		new URL(String(fetch.mock.calls[0][0])).searchParams.get("page"),
	).toBe("0");
	const firstActive = screen.getByTitle("1");
	expect(firstActive.className).toContain("ant-pagination-item-active");

	fireEvent.click(screen.getByTitle("2"));
	await flush();

	expect(
		new URL(String(fetch.mock.calls[1][0])).searchParams.get("page"),
	).toBe("1");
	expect(screen.getByTitle("2").className).toContain(
		"ant-pagination-item-active",
	);

	// Changing the owner filter resets to page 0: the next request goes out
	// with page=0 and the UI is back on page 1.
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Owner filter" }));
	fireEvent.click(screen.getByText("Product"));
	await flush();

	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Product" }));
	fireEvent.click(screen.getByText("Reef tanks"));
	await flush();

	const lastCall = fetch.mock.calls[fetch.mock.calls.length - 1];
	expect(new URL(String(lastCall[0])).pathname).toBe(
		"/api/v1/products/PRD_1/media",
	);
	expect(new URL(String(lastCall[0])).searchParams.get("page")).toBe("0");
	expect(screen.getByTitle("1").className).toContain(
		"ant-pagination-item-active",
	);
});

it("mediaList_productFilterLabelsVariantOwnedRows", async () => {
	stubFetch(
		page([], 0, 1, 0),
		productsPage([productFixture]),
		page(
			[mediaRow({ productId: null, variantId: "VAR_9", mediaId: "MED_7" })],
			0,
			1,
			1,
		),
	);

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Owner filter" }));
	fireEvent.click(screen.getByText("Product"));
	await flush();

	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Product" }));
	fireEvent.click(screen.getByText("Reef tanks"));
	await flush();

	// The product endpoint returns the variant-owned row, so the row is
	// labelled from its returned variantId, never from the filter.
	expect(screen.getByText("Variant VAR_9")).toBeTruthy();
	expect(screen.queryByText("Product PRD_1")).toBeNull();
});

it("mediaList_returnsToPreviousPageAfterDeletingLastRow", async () => {
	release.value = true;
	const fetch = stubFetch(
		page([mediaRow({ mediaId: "MED_FIRST" })], 0, 2, 21),
		page([mediaRow({ mediaId: "MED_ONLY" })], 1, 2, 21),
		ok(null),
		page([mediaRow({ mediaId: "MED_FIRST" })], 0, 1, 20),
	);

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByTitle("2"));
	await flush();
	expect(
		screen.getByRole("button", { name: "Delete media MED_ONLY" }),
	).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: "Delete media MED_ONLY" }));
	fireEvent.click(screen.getByRole("button", { name: "Delete media" }));
	await flush();

	const deletes = fetch.mock.calls.filter(
		([, init]) => (init as RequestInit)?.method === "DELETE",
	);
	expect(deletes).toHaveLength(1);
	expect(new URL(String(deletes[0][0])).pathname).toBe(
		"/api/v1/media/MED_ONLY",
	);

	const pages = fetch.mock.calls.map(([url]) =>
		new URL(String(url)).searchParams.get("page"),
	);
	expect(pages[pages.length - 1]).toBe("0");
	expect(screen.getByTitle("1").className).toContain(
		"ant-pagination-item-active",
	);
});

it("mediaPreview_neverLoadsUnexpectedUrl", async () => {
	stubFetch(
		page([
			mediaRow({
				mediaId: "MED_EXTERNAL",
				url: externalUrl,
				productId: null,
				variantId: "VAR_1",
			}),
			mediaRow({
				mediaId: "MED_SCRIPT",
				url: "javascript:alert(1)",
				productId: null,
				variantId: "VAR_2",
			}),
			mediaRow({ mediaId: "MED_CLOUDINARY", url: cloudinaryUrl }),
		]),
	);

	const { container } = render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	// The external HTTPS host renders a labelled link and no image.
	const external = screen.getByRole("link", {
		name: /cdn\.example\.com/,
	}) as HTMLAnchorElement;
	expect(external.getAttribute("href")).toBe(externalUrl);
	expect(external.getAttribute("rel")).toBe("noreferrer");
	expect(
		container.querySelector('img[src^="https://cdn.example.com"]'),
	).toBeNull();

	// A javascript: URL renders neither image nor link.
	expect(
		screen.queryByRole("link", { name: /javascript/i }),
	).toBeNull();
	expect(container.querySelector('a[href^="javascript"]')).toBeNull();
	expect(container.querySelector('img[src^="javascript"]')).toBeNull();

	// The configured Cloudinary host renders an image.
	expect(
		container.querySelector(`img[src="${cloudinaryUrl}"]`),
	).not.toBeNull();
});

it("mediaDelete_explainsPossibleThumbnailRemoval", async () => {
	release.value = true;
	const fetch = stubFetch(
		page([
			mediaRow({ mediaId: "MED_TARGET", url: cloudinaryUrl }),
		]),
		ok(null),
		page([]),
	);

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "Delete media MED_TARGET" }),
	);

	// The confirmation names the row target and warns about the fallout
	// before anything is deleted.
	expect(screen.getByText(/MED_TARGET/)).toBeTruthy();
	expect(
		screen.getByText(/product and variant rendering/i),
	).toBeTruthy();
	const deletesBeforeConfirm = fetch.mock.calls.filter(
		([, init]) => (init as RequestInit)?.method === "DELETE",
	);
	expect(deletesBeforeConfirm).toHaveLength(0);

	fireEvent.click(screen.getByRole("button", { name: "Delete media" }));
	await flush();

	const deletes = fetch.mock.calls.filter(
		([, init]) => (init as RequestInit)?.method === "DELETE",
	);
	expect(deletes).toHaveLength(1);
	expect(new URL(String(deletes[0][0])).pathname).toBe(
		"/api/v1/media/MED_TARGET",
	);
});

it("mediaDelete_isEnabledAfterReleaseCheck", async () => {
	release.value = true;
	stubFetch(page([mediaRow({ mediaId: "MED_RELEASED" })]));

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	const button = screen.getByRole("button", {
		name: "Delete media MED_RELEASED",
	}) as HTMLButtonElement;
	expect(button.disabled).toBe(false);

	fireEvent.click(button);
	await flush();

	expect(
		screen.getByText(/may disappear from product and variant rendering/i),
	).toBeTruthy();
});

it("mediaDelete403_showsTheSharedPermissionMessage", async () => {
	release.value = true;
	stubFetch(
		page([mediaRow({ mediaId: "MED_DENIED" })]),
		{
			status: 403,
			body: { code: 403, message: "Access denied", data: null },
		},
	);

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "Delete media MED_DENIED" }),
	);
	fireEvent.click(screen.getByRole("button", { name: "Delete media" }));
	await flush();

	expect(
		screen.getByText("You do not have permission to perform this action."),
	).toBeTruthy();
});

it("mediaDelete401_navigatesToLoginWithoutAStaleToast", async () => {
	release.value = true;
	stubFetch(
		page([mediaRow({ mediaId: "MED_GONE" })]),
		{
			status: 401,
			body: { code: 401, message: "Unauthorized", data: null },
		},
	);

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	fireEvent.click(
		screen.getByRole("button", { name: "Delete media MED_GONE" }),
	);
	fireEvent.click(screen.getByRole("button", { name: "Delete media" }));
	await flush();

	expect(nav.replace).toHaveBeenCalledWith("/admin/login");
	expect(
		screen.queryByText("You do not have permission to perform this action."),
	).toBeNull();
	expect(
		screen.queryByText("Your session was refreshed. Please try again."),
	).toBeNull();
});

it("mediaCreate_usesExactlyOneOwner", async () => {
	// A URL-routed mock keeps this test robust against call-order changes.
	const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);

		if (url.includes("/products/PRD_1/media")) {
			return jsonResponse(page([], 0, 1, 0).body);
		}

		if (url.includes("/media?") || url.endsWith("/media")) {
			if ((init?.method ?? "GET") === "POST") {
				const body = JSON.parse(String(init?.body));
				return jsonResponse(
					ok({ ...mediaRow(), ...body, mediaId: "MED_CREATED" }).body,
				);
			}
			// One row keeps the empty-state's own "Add media" button away
			// from the header action.
			const body = page([mediaRow()], 0, 1, 1);
			return jsonResponse(body.body);
		}

		if (url.includes("/products?")) {
			return jsonResponse(productsPage([productFixture]).body);
		}

		if (url.includes("/products/reef-tanks")) {
			return jsonResponse(productDetail().body);
		}

		return Promise.reject(new Error(`Unexpected request: ${url}`));
	});
	vi.stubGlobal("fetch", fetch);

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	fireEvent.click(screen.getByRole("button", { name: /add media/i }));
	await waitFor(() => {
		expect(screen.getByRole("dialog")).toBeTruthy();
	});

	// Default owner type is Product; exactly that one owner goes in the body.
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Product" }));
	fireEvent.click(screen.getByText("Reef tanks"));
	fireEvent.change(screen.getByLabelText("Image URL"), {
		target: { value: "https://example.com/image.png" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save media" }));
	await waitFor(() => {
		expect(
			fetch.mock.calls.some(
				([, init]) => (init as RequestInit)?.method === "POST",
			),
		).toBe(true);
	});

	const firstPost = fetch.mock.calls.find(
		([, init]) => (init as RequestInit)?.method === "POST",
	);
	const firstBody = JSON.parse(String((firstPost?.[1] as RequestInit).body));
	expect(firstBody).toEqual({
		url: "https://example.com/image.png",
		productId: "PRD_1",
	});
	expect(firstBody).not.toHaveProperty("variantId");
	await flush();

	// Switching the owner type clears the old choice: a variant picked before
	// switching to Product must not leak into the Product-owned create.
	fireEvent.click(screen.getByRole("button", { name: /add media/i }));
	await waitFor(() => {
		expect(screen.getByRole("dialog")).toBeTruthy();
	});

	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Owner type" }));
	fireEvent.click(screen.getByText("Variant"));
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Product" }));
	fireEvent.click(screen.getByText("Reef tanks"));
	await waitFor(() => {
		expect(screen.getByRole("combobox", { name: "Variant" })).toBeTruthy();
	});
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Variant" }));
	fireEvent.click(screen.getByText("SKU-1"));

	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Owner type" }));
	fireEvent.click(screen.getByText("Product"));

	fireEvent.change(screen.getByLabelText("Image URL"), {
		target: { value: "https://example.com/second.png" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save media" }));
	// No product was chosen after the switch, so no second POST goes out.
	await flush();

	const posts = fetch.mock.calls.filter(
		([, init]) => (init as RequestInit)?.method === "POST",
	);
	expect(posts).toHaveLength(1);
});

it("mediaList_recovered401OnReadHidesPayloadAndOffersManualRetry", async () => {
	setAccessToken("rehydrated-token");
	release.value = true;
	const revalidate = deferred<void>();
	vi.mocked(useAuthStore.getState().revalidate).mockReturnValue(revalidate.promise);
	const secondGet = deferred<Response>();
	let getCount = 0;
	let deleteCount = 0;
	const fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
		if (init?.method === "DELETE") {
			deleteCount += 1;
			return Promise.resolve(respond(ok(null).body));
		}
		getCount += 1;
		const body = page([mediaRow({ mediaId: "MED_VISIBLE" })]).body;
		if (getCount === 1) {
			return Promise.resolve(respond(body));
		}
		if (getCount === 2) {
			return secondGet.promise;
		}
		return Promise.resolve(respond(body));
	});
	vi.stubGlobal("fetch", fetch);

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();
	expect(
		screen.getByRole("button", { name: "Edit media MED_VISIBLE" }),
	).toBeTruthy();

	fireEvent.click(
		screen.getByRole("button", { name: "Delete media MED_VISIBLE" }),
	);
	fireEvent.click(screen.getByRole("button", { name: "Delete media" }));
	await flush();
	expect(deleteCount).toBe(1);
	expect(getCount).toBe(2);

	// The reload read is refused with 401; while the session is rechecked the
	// protected rows are gone and only the loading state remains.
	await act(async () => {
		secondGet.resolve(respond({ code: 401, message: "Unauthorized", data: null }, 401));
	});
	await flush();
	expect(
		screen.queryByRole("button", { name: "Edit media MED_VISIBLE" }),
	).toBeNull();
	expect(screen.getByLabelText("Loading media")).toBeTruthy();

	await act(async () => {
		revalidate.resolve();
	});
	await flush();
	expect(screen.getByText("We couldn't load media")).toBeTruthy();
	expect(screen.getByText(/Your session was refreshed/)).toBeTruthy();
	// No automatic re-read and no replay of the delete; only the explicit
	// Retry is offered.
	expect(getCount).toBe(2);
	expect(deleteCount).toBe(1);

	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	await flush();
	expect(getCount).toBe(3);
	expect(
		screen.getByRole("button", { name: "Edit media MED_VISIBLE" }),
	).toBeTruthy();
});

it("mediaList_genuine403DenialKeepsAccessDenied", async () => {
	stubFetch({
		status: 403,
		body: { code: 403, message: "Access denied", data: null },
	});

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	expect(screen.getByText("You do not have access to media")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
});

it("mediaList_productLookupUsesBackendKeywordAndKeepsSelection", async () => {
	const urls: string[] = [];
	const fetch = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		urls.push(url);
		if (url.includes("/products?")) {
			return jsonResponse(
				productsPage(
					new URL(url).searchParams.get("keyword")
						? []
						: [productFixture],
				).body,
			);
		}
		if (url.includes("/media?") || url.endsWith("/media")) {
			return jsonResponse(page([mediaRow()]).body);
		}
		return Promise.reject(new Error(`Unexpected request: ${url}`));
	});
	vi.stubGlobal("fetch", fetch);

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Owner filter" }));
	fireEvent.click(screen.getByText("Product"));
	await flush();

	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Product" }));
	fireEvent.click(screen.getByText("Reef tanks"));
	await flush();

	const before = urls.length;
	fireEvent.change(screen.getByRole("combobox", { name: "Product" }), {
		target: { value: "nomatch" },
	});
	await waitFor(
		() => {
			expect(
				urls.some(
					(url) => new URL(url).searchParams.get("keyword") === "nomatch",
				),
			).toBe(true);
		},
		{ timeout: 2000 },
	);
	await flush();

	// The search reached the backend, and the chosen product (and its media
	// scope) survived the option refresh even though it is not in the results.
	expect(screen.getAllByText("Reef tanks").length).toBeGreaterThan(0);
	expect(
		urls
			.slice(before)
			.some((url) => url.includes("/products/PRD_1/media")),
	).toBe(false);
});

it("mediaList_productLookupIgnoresStaleKeywordResults", async () => {
	const first = deferred<Response>();
	const second = deferred<Response>();
	let productRequests = 0;
	const fetch = vi.fn((input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("/products?")) {
			productRequests += 1;
			return productRequests === 1 ? first.promise : second.promise;
		}
		return Promise.resolve(respond(page([mediaRow()]).body));
	});
	vi.stubGlobal("fetch", fetch);

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Owner filter" }));
	fireEvent.click(screen.getByText("Product"));
	await flush();
	expect(productRequests).toBe(1);

	fireEvent.change(screen.getByRole("combobox", { name: "Product" }), {
		target: { value: "new" },
	});
	await waitFor(() => expect(productRequests).toBe(2), { timeout: 2000 });

	await act(async () => {
		second.resolve(respond(productsPage([productFixture]).body));
	});
	await flush();
	expect(screen.getAllByText("Reef tanks").length).toBeGreaterThan(0);

	// The older, slower answer must not overwrite the newer options.
	await act(async () => {
		first.resolve(
			respond(
				productsPage([
					{ ...productFixture, productId: "PRD_2", name: "Other product" },
				]).body,
			),
		);
	});
	await flush();
	expect(screen.queryByText("Other product")).toBeNull();
	expect(screen.getAllByText("Reef tanks").length).toBeGreaterThan(0);
});

it("mediaList_statusChangeAndPermissionLossResetScope", async () => {
	const urls: string[] = [];
	const draft = {
		...productFixture,
		productId: "PRD_HIDDEN",
		slug: "hidden",
		name: "Hidden draft",
		status: "DRAFT",
	};
	const fetch = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		urls.push(url);
		if (url.includes("/products?")) {
			const status = new URL(url).searchParams.get("status");
			return jsonResponse(productsPage(status === "DRAFT" ? [draft] : []).body);
		}
		return Promise.resolve(respond(page([mediaRow()]).body));
	});
	vi.stubGlobal("fetch", fetch);

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();

	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Owner filter" }));
	fireEvent.click(screen.getByText("Product"));
	await flush();

	// Pick DRAFT, then the hidden product. product:create is held, so both are
	// offered.
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Product status" }));
	fireEvent.click(screen.getByText("Draft"));
	await flush();
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Product" }));
	fireEvent.click(screen.getByText("Hidden draft"));
	await flush();
	expect(screen.getAllByText("Hidden draft").length).toBeGreaterThan(0);

	// Changing status is an intentional reset: the old owner is discarded.
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Product status" }));
	fireEvent.click(screen.getByText("Active"));
	await flush();
	expect(selectedProductLabel()).not.toBe("Hidden draft");
	expect(screen.getByText("Choose an owner")).toBeTruthy();

	// Re-select a hidden owner, then revoke product:create mid-session.
	const withoutHidden = {
		...adminUser,
		permissions: adminUser.permissions.filter((p) => p !== "product:create"),
	};
	act(() => {
		useAuthStore.setState({ user: withoutHidden });
	});
	await flush();

	expect(screen.queryByRole("combobox", { name: "Product status" })).toBeNull();
	expect(selectedProductLabel()).not.toBe("Hidden draft");
	expect(screen.getByText("Choose an owner")).toBeTruthy();
	const lastProducts = [...urls]
		.reverse()
		.find((url) => url.includes("/products?"));
	expect(new URL(lastProducts!).searchParams.get("status")).toBe("ACTIVE");
	expect(new URL(lastProducts!).searchParams.get("keyword")).toBeNull();
});

it("closes the edit dialog and reloads the first page when product:create is revoked", async () => {
	let resolveSecond!: (response: Response) => void;
	const second = new Promise<Response>((resolve) => {
		resolveSecond = resolve;
	});
	let mediaCalls = 0;
	const fetch = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("/media?")) {
			mediaCalls += 1;
			return mediaCalls <= 2
				? jsonResponse(page([mediaRow()], mediaCalls - 1, 2, 21).body)
				: second;
		}
		return respond(page([]).body);
	});
	vi.stubGlobal("fetch", fetch);

	render(
		<App>
			<MediaLibraryView />
		</App>,
	);
	await flush();
	fireEvent.click(screen.getByTitle("2"));
	await flush();
	expect(screen.getByText(cloudinaryUrl)).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Edit media MED_1" }));
	expect(await screen.findByRole("dialog")).toBeTruthy();
	expect(screen.getByLabelText("Image URL")).toHaveProperty("value", cloudinaryUrl);

	const withoutHidden = {
		...adminUser,
		permissions: adminUser.permissions.filter((p) => p !== "product:create"),
	};
	act(() => {
		useAuthStore.setState({ user: withoutHidden });
	});
	await flush();

	expect(mediaCalls).toBe(3);
	const requestedPages = fetch.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("page"));
	expect(requestedPages).toEqual(["0", "1", "0"]);
	expect(screen.queryByRole("dialog")).toBeNull();
	expect(screen.queryByText(cloudinaryUrl)).toBeNull();
	expect(screen.getByLabelText("Loading media")).toBeTruthy();

	resolveSecond(respond(page([]).body));
	await flush();
	expect(screen.getByText("No media here yet")).toBeTruthy();
});

it("does not close a new edit dialog when a revoked dialog's save finishes", async () => {
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>((resolve) => { finish = resolve; });
	const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
		init?.method === "PATCH"
			? pending
			: respond(page([mediaRow()]).body),
	);
	vi.stubGlobal("fetch", fetch);

	render(<App><MediaLibraryView /></App>);
	await flush();
	const edit = () => fireEvent.click(screen.getByRole("button", { name: "Edit media MED_1" }));
	edit();
	fireEvent.click(screen.getByRole("button", { name: "Save media" }));
	await waitFor(() => expect(fetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));

	act(() => {
		useAuthStore.setState({ user: {
			...adminUser,
			permissions: adminUser.permissions.filter((permission) => permission !== "product:create"),
		} });
	});
	await flush();
	expect(screen.queryByRole("dialog")).toBeNull();
	edit();
	const draft = `${cloudinaryUrl}?v=2`;
	fireEvent.change(screen.getByLabelText("Image URL"), { target: { value: draft } });

	finish(respond({ code: 200, message: "OK", data: mediaRow() }));
	await flush();
	expect(screen.getByLabelText("Image URL")).toHaveProperty("value", draft);
});
