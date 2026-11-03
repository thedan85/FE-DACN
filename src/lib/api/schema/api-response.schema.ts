
import { z } from "zod";

export const createApiResponseSchema = <T extends z.ZodType>(
	dataSchema: T,
) =>
	z.object({
		code: z.number().int(),
		message: z.string(),
		data: dataSchema,
	});

/**
 * The envelope every successful `DELETE` (and any other side effect that
 * returns no body) answers with: HTTP 200 and `data: null`.
 */
export const nullDataResponseSchema = createApiResponseSchema(z.null());