
import { z } from "zod";

export const createPageResponseSchema = <T extends z.ZodType>(
	itemSchema: T,
) =>
	z.object({
		content: z.array(itemSchema),
		page: z.number().int().nonnegative(),
		size: z.number().int().nonnegative(),
		totalElements: z.number().int().nonnegative(),
		totalPages: z.number().int().nonnegative(),
	});