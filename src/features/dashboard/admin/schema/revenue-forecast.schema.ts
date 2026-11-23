import { z } from "zod";

import { createApiResponseSchema } from "@/lib/api/schema";

const isoDateTimeSchema = z.string().refine(
	(value) => !Number.isNaN(Date.parse(value)),
	{ message: "invalid timestamp" },
);

const monthPointSchema = z
	.object({
		date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid month date"),
		predicted: z.number(),
		lower: z.number(),
		upper: z.number(),
	})
	.refine(
		(point) => point.lower <= point.predicted && point.predicted <= point.upper,
		{ message: "invalid forecast interval", path: ["lower"] },
	);

const annualTotalSchema = z.object({
	year: z.number().int(),
	months: z.number().int().min(1).max(12),
	predicted: z.number(),
	lower: z.number(),
	upper: z.number(),
});

export const RevenueForecastSchema = z.object({
	generatedAt: isoDateTimeSchema,
	model: z.string(),
	trainingMonths: z.number().int().nonnegative(),
	holdoutMonths: z.number().int().nonnegative(),
	mae: z.number(),
	mape: z.number().nullable(),
	months: z.array(monthPointSchema).min(1),
	annual: z.array(annualTotalSchema).min(1),
});

export const RevenueForecastResponseSchema =
	createApiResponseSchema(RevenueForecastSchema);
