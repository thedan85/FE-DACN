
import { z } from "zod";

export const createApiResponseSchema = <T extends z.ZodType>(
	dataSchema: T,
) =>
	z.object({
		code: z.number().int(),
		message: z.string(),
		data: dataSchema,
	});