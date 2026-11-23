import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { OrderPage } from "@/features/orders/types";

import {
	getDashboardSummary,
	getRevenueForecast,
	listRecentOrders,
} from "../api/dashboard.api";
import type { DashboardSummary } from "../types";
import { DashboardView } from "./dashboard-view";

const nav = vi.hoisted(() => ({
	replace: vi.fn(),
	router: { replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({
	useRouter: () => nav.router,
	usePathname: () => "/admin/dashboard",
	useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("../api/dashboard.api", () => ({
	DASHBOARD_RANGES: [7, 30, 90],
	parseDashboardRange: () => 30,
	getDashboardSummary: vi.fn(),
	listRecentOrders: vi.fn(),
	getRevenueForecast: vi.fn(),
}));

vi.mock("@/stores/auth-store", () => ({
	useAuthStore: (selector: (state: { user: { name: string } }) => unknown) =>
		selector({ user: { name: "Admin" } }),
}));

const summary: DashboardSummary = {
	generatedAt: "2026-11-23T03:00:00Z",
	from: "2026-10-25",
	to: "2026-11-23",
	granularity: "DAY",
	revenue: { value: 1500000, previous: 1000000, changePct: 50 },
	orders: { value: 8, previous: 6, changePct: 33.3 },
	activeProducts: 42,
	lowStock: { threshold: 10, count: 2 },
	revenueSeries: [],
	orderStatus: [],
	completionRate: { completed: 5, total: 8, pct: 62.5 },
	lowStockProducts: [],
};

const orders: OrderPage = {
	content: [],
	page: 0,
	size: 6,
	totalElements: 0,
	totalPages: 0,
};

beforeEach(() => {
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
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

it("keeps the summary KPI when the forecast request rejects", async () => {
	vi.mocked(getDashboardSummary).mockResolvedValue(summary);
	vi.mocked(listRecentOrders).mockResolvedValue(orders);
	vi.mocked(getRevenueForecast).mockRejectedValue(new Error("forecast failed"));

	render(
		<App>
			<DashboardView />
		</App>,
	);

	await waitFor(() => {
		expect(screen.getAllByText(/1\.500\.000/).length).toBeGreaterThan(0);
	});
	expect(screen.getByText(/Revenue forecast/)).toBeTruthy();
});
