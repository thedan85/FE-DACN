import { z } from "zod";

import { createApiResponseSchema } from "@/lib/api/schema";

const monthPointSchema = z
	.object({
		date: z.string(),
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
	months: z.number().int().positive(),
	predicted: z.number(),
	lower: z.number(),
	upper: z.number(),
});

export const RevenueForecastSchema = z.object({
	generatedAt: z.string(),
	model: z.string(),
	trainingMonths: z.number().int().nonnegative(),
	holdoutMonths: z.number().int().nonnegative(),
	mae: z.number(),
	mape: z.number().nullable(),
	months: z.array(monthPointSchema),
	annual: z.array(annualTotalSchema),
});

export const RevenueForecastResponseSchema =
	createApiResponseSchema(RevenueForecastSchema);
