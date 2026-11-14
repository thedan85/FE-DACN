import { expect, it } from "vitest";
import { VariantUpdateRequestSchema } from "./catalog.schema";

it("retains optional nonnegative safe integer stock revisions", () => {
	expect(VariantUpdateRequestSchema.parse({ stock: 2, expectedStockRevision: 7 }))
		.toEqual({ stock: 2, expectedStockRevision: 7 });
	expect(VariantUpdateRequestSchema.parse({ sku: "metadata" })).toEqual({ sku: "metadata" });
	for (const expectedStockRevision of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
		expect(VariantUpdateRequestSchema.safeParse({ stock: 2, expectedStockRevision }).success).toBe(false);
	}
});
