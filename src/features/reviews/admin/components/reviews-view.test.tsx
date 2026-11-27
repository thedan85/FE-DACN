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
import { App, ConfigProvider } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { clearSession } from "@/features/auth/session";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

import { deleteAdminReview, listAdminReviews } from "../api/admin-reviews.api";
import type { AdminReview } from "../schema/admin-reviews.schema";
import { ReviewsView } from "./reviews-view";

const nav = vi.hoisted(() => {
	const replace = vi.fn();
	// A module-level instance: a fresh object per call would re-fire effects
	// that list the router as a dependency.
	return { search: "", replace, router: { replace } };
});

vi.mock("next/navigation", () => ({
	useRouter: () => nav.router,
	usePathname: () => "/admin/reviews",
	useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("../api/admin-reviews.api", () => ({
	listAdminReviews: vi.fn(),
	deleteAdminReview: vi.fn(),
}));

vi.mock("@/features/products/admin/components/admin-catalog-theme", () => ({
	AdminCatalogTheme: ({ children }: { children: ReactNode }) => (
		<div data-testid="admin-catalog-theme">{children}</div>
	),
}));

const user = {
	userId: "USR_ADMIN",
	email: "admin@example.com",
	name: "Admin Actor",
	phone: "0900000001",
	address: null,
	roleCode: "admin",
	roleName: "Administrator",
	permissions: ["review:read", "review:delete"],
	hasPassword: true,
};

const review: AdminReview = {
	reviewId: "REV_1",
	customerId: "CUS_1",
	customerName: "An",
	rating: 5,
	comment: "The fish arrived healthy and the tank looks great.",
	productId: "PRD_1",
	productName: "Cichlid",
	variantId: "VAR_1",
	variantSku: "SKU-1",
	verifiedPurchase: true,
	createdAt: "2026-11-20T10:00:00Z",
	updatedAt: "2026-11-20T10:00:00Z",
};

function page(
	content: AdminReview[] = [review],
	pageNumber = 0,
	totalPages = 1,
	totalElements = content.length,
) {
	return { content, page: pageNumber, size: 20, totalElements, totalPages };
}

async function flush() {
	await act(async () => {
		await Promise.resolve();
	});
}

function reviewsElement() {
	return (
		<ConfigProvider theme={{ token: { motion: false } }}>
			<App>
				<ReviewsView />
			</App>
		</ConfigProvider>
	);
}

function renderReviews() {
	return render(reviewsElement());
}

beforeEach(() => {
	nav.search = "";
	nav.replace.mockReset();
	clearSession();
	useAuthStore.setState({ status: "authenticated", user });
	// antd's responsive pieces read these; jsdom provides neither.
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
		matches: false,
		addListener() {},
		removeListener() {},
		addEventListener() {},
		removeEventListener() {},
	}));
	vi.stubGlobal("ResizeObserver", class {
		observe() {}
		unobserve() {}
		disconnect() {}
	});
	vi.mocked(listAdminReviews).mockReset().mockResolvedValue(page());
	vi.mocked(deleteAdminReview).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
	cleanup();
	clearSession();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it("shows the full comment in a dialog with a close action", async () => {
	useAuthStore.setState({ status: "authenticated", user: {
		...user, permissions: ["review:read"],
	} });
	renderReviews();

	expect(await screen.findByText("An")).toBeTruthy();
	expect(screen.getByText("Cichlid")).toBeTruthy();
	expect(screen.getByText("SKU-1")).toBeTruthy();
	expect(screen.queryByText(review.comment)).toBeNull();

	fireEvent.click(screen.getByRole("button", { name: "Show details" }));
	const dialog = within(await screen.findByRole("dialog"));
	expect(dialog.getByText("Review details")).toBeTruthy();
	expect(dialog.getByRole("heading", { name: "Comment" })).toBeTruthy();
	expect(dialog.getByText(review.comment)).toBeTruthy();
	// Delete is gated on review:delete, not on review:read.
	expect(dialog.queryByRole("button", { name: "Delete" })).toBeNull();
	fireEvent.click(dialog.getByRole("button", { name: "Close" }));
	await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("deletes from review details after confirmation", async () => {
	renderReviews();

	await screen.findByText("An");
	fireEvent.click(screen.getByRole("button", { name: "Show details" }));
	fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
	expect(await screen.findByText("Delete review by An?")).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Delete review" }));

	await waitFor(() => expect(deleteAdminReview).toHaveBeenCalledWith("REV_1"));
	// Success closes both overlays and reloads the list.
	await waitFor(() => {
		expect(listAdminReviews).toHaveBeenCalledTimes(2);
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(screen.queryByText(review.comment)).toBeNull();
	});
});

it("renders access denied without review:read", () => {
	useAuthStore.setState({ status: "authenticated", user: {
		...user, permissions: [],
	} });
	renderReviews();

	expect(screen.getByText("You do not have permission to view this page")).toBeTruthy();
	expect(listAdminReviews).not.toHaveBeenCalled();
});

it("shows a one-based page while sending a zero-based page", async () => {
	nav.search = "page=2";
	renderReviews();
	await flush();

	expect(listAdminReviews).toHaveBeenCalledWith(
		expect.objectContaining({ page: 1 }),
		expect.any(AbortSignal),
	);
});

it("resets the page and applies the rating filter", async () => {
	nav.search = "page=3";
	vi.mocked(listAdminReviews).mockResolvedValue(page([review], 2, 5));

	const view = renderReviews();
	await flush();

	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Filter by rating" }));
	fireEvent.click(await screen.findByTitle("4 stars"));
	expect(nav.replace).toHaveBeenCalledWith("/admin/reviews?rating=4");

	nav.search = "rating=4";
	view.rerender(reviewsElement());
	await flush();

	expect(listAdminReviews).toHaveBeenLastCalledWith(
		expect.objectContaining({ page: 0, rating: 4 }),
		expect.any(AbortSignal),
	);
});

it("trims the keyword before sending it", async () => {
	renderReviews();
	await flush();

	const input = screen.getByRole("searchbox", { name: "Search reviews" });
	fireEvent.change(input, { target: { value: "  cichlid  " } });
	fireEvent.keyDown(input, { key: "Enter", code: "Enter", keyCode: 13 });

	await waitFor(() =>
		expect(listAdminReviews).toHaveBeenLastCalledWith(
			expect.objectContaining({ page: 0, keyword: "cichlid" }),
			expect.any(AbortSignal),
		),
	);
});

it("keeps the confirmation open and shows the API error when delete fails", async () => {
	vi.mocked(deleteAdminReview).mockRejectedValue(
		new ApiError("review not found: REV_1", 404),
	);
	renderReviews();

	await screen.findByText("An");
	fireEvent.click(screen.getByRole("button", { name: "Show details" }));
	fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
	fireEvent.click(await screen.findByRole("button", { name: "Delete review" }));

	expect(await screen.findByText("review not found: REV_1")).toBeTruthy();
	expect(screen.getByText("Delete review by An?")).toBeTruthy();
});
