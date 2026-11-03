
import type { z } from "zod";

import { ApiError } from "./client";

/**
 * Validates an untrusted API payload against its schema, or throws an
 * `ApiError` describing which response disappointed us.
 *
 * Every API module repeats "parse, and if it fails throw a 500-shaped
 * `ApiError` carrying the payload" — this is that rule once. Note the status
 * is deliberately 500 rather than the HTTP status that came back: a 200 whose
 * body does not match the contract is a server-side contract break, not a
 * client error, and conflating it with the response code would make callers
 * treat it as a 4xx they can recover from.
 */
export function parseOrThrow<T extends z.ZodType>(
	schema: T,
	payload: unknown,
	description: string,
): z.infer<T> {
	const parsed = schema.safeParse(payload);

	if (!parsed.success) {
		throw new ApiError(
			`${description} did not match the expected contract.`,
			500,
			payload,
		);
	}

	return parsed.data;
}
