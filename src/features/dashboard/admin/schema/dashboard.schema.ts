import { z } from "zod";

import {
	createApiResponseSchema,
	OrderStatusSchema,
} from "@/lib/api/schema";

/**
 * Dashboard summary DTO, mirroring `DashboardSummaryResponse` in the backend.
 *
 * Money values stay numbers: the backend sends `BigDecimal` as a JSON number,
 * and the display layer formats them as VND. `changePct` is nullable because a
 * period with no previous-window revenue or orders has no percentage to show.
 */
export const DashboardSummarySchema = z.object({
	generatedAt: z.string(),
	from: z.string(),
	to: z.string(),
	granularity: z.enum(["DAY", "WEEK"]),
	revenue: z.object({
		value: z.number(),
		previous: z.number(),
		changePct: z.number().nullable(),
	}),
	orders: z.object({
		value: z.number().int().nonnegative(),
		previous: z.number().int().nonnegative(),
		changePct: z.number().nullable(),
	}),
	activeProducts: z.number().int().nonnegative(),
	lowStock: z.object({
		threshold: z.number().int().nonnegative(),
		count: z.number().int().nonnegative(),
	}),
	revenueSeries: z.array(
		z.object({
			date: z.string(),
			revenue: z.number(),
			orders: z.number().int().nonnegative(),
		}),
	),
	orderStatus: z.array(
		z.object({
			status: OrderStatusSchema,
			count: z.number().int().nonnegative(),
		}),
	),
	completionRate: z.object({
		completed: z.number().int().nonnegative(),
		total: z.number().int().nonnegative(),
		pct: z.number(),
	}),
	lowStockProducts: z.array(
		z.object({
			productId: z.string(),
			slug: z.string(),
			name: z.string(),
			thumbnail: z.string().nullable(),
			stock: z.number().int().nonnegative(),
		}),
	),
});

export const DashboardSummaryResponseSchema =
	createApiResponseSchema(DashboardSummarySchema);
