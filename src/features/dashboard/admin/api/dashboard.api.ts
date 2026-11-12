import { getAuthHeaders } from "@/features/auth/session";
import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import { createApiResponseSchema, createPageResponseSchema } from "@/lib/api/schema";
import { OrderSchema } from "@/features/orders/schema/order.schema";
import type { OrderPage } from "@/features/orders/types";

import { DashboardSummaryResponseSchema } from "../schema/dashboard.schema";
import type { DashboardSummary } from "../types";

/**
 * Admin dashboard reads.
 *
 * `days` is deliberately a closed union: the backend rejects anything but
 * 7, 30 or 90 with a 400, and the chart's granularity follows the same range
 * (daily for 7/30, weekly for 90). Recent orders reuse the staff listing:
 * there is no admin-orders route, and the dashboard only needs the newest page.
 */

export const DASHBOARD_RANGES = [7, 30, 90] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export const RECENT_ORDERS_SIZE = 6;

export function parseDashboardRange(value: string | null | undefined): DashboardRange {
	const parsed = Number(value);

	return DASHBOARD_RANGES.includes(parsed as DashboardRange)
		? (parsed as DashboardRange)
		: 30;
}

export async function getDashboardSummary(
	days: DashboardRange,
): Promise<DashboardSummary> {
	const payload = await apiFetch<unknown>(
		`admin/dashboard/summary?days=${days}`,
		{ headers: getAuthHeaders() },
	);

	return parseOrThrow(
		DashboardSummaryResponseSchema,
		payload,
		"The dashboard summary response",
	).data;
}

const recentOrdersResponseSchema = createApiResponseSchema(
	createPageResponseSchema(OrderSchema),
);

export async function listRecentOrders(
	size = RECENT_ORDERS_SIZE,
): Promise<OrderPage> {
	const params = new URLSearchParams({ page: "0", size: String(size) });
	const payload = await apiFetch<unknown>(`staff/orders?${params.toString()}`, {
		headers: getAuthHeaders(),
	});

	return parseOrThrow(
		recentOrdersResponseSchema,
		payload,
		"The recent orders response",
	).data;
}
