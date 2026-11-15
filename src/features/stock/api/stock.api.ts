import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import { createApiResponseSchema } from "@/lib/api/schema/api-response.schema";
import { stockIdSchema, stockSnapshotsSchema } from "../schema";

const inputSchema = z.object({
	productIds: z.array(stockIdSchema),
	variantIds: z.array(stockIdSchema),
}).transform(({ productIds, variantIds }) => ({
	productIds: [...new Set(productIds)],
	variantIds: [...new Set(variantIds)],
})).refine(
	(input) => {
		const count = new Set([...input.productIds, ...input.variantIds]).size;
		return count >= 1 && count <= 100;
	},
	"Combined unique stock IDs must number between 1 and 100.",
);
const responseSchema = createApiResponseSchema(stockSnapshotsSchema);

export async function fetchStockSnapshots(
	input: { productIds: string[]; variantIds: string[] },
	signal?: AbortSignal,
) {
	const body = inputSchema.parse(input);
	const payload = await apiFetch<unknown>("stock/snapshots", {
		method: "POST",
		body: JSON.stringify(body),
		cache: "no-store",
		signal,
	});
	return parseOrThrow(responseSchema, payload, "Stock snapshot response").data;
}
