import type { z } from "zod";

import type { DashboardSummarySchema } from "../schema/dashboard.schema";

/** Dashboard DTO types (single source: `../schema/dashboard.schema.ts`). */

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
export type DashboardRevenuePoint = DashboardSummary["revenueSeries"][number];
export type DashboardOrderStatus = DashboardSummary["orderStatus"][number]["status"];
export type DashboardLowStockProduct =
	DashboardSummary["lowStockProducts"][number];
