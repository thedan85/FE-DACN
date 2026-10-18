
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
 * Generic TypeScript representation of ApiResponse<T>.
 * Use createApiResponseSchema() to validate concrete responses.
 */
export interface ApiResponse<T> {
	code: number;
	message: string;
	data: T;
}
