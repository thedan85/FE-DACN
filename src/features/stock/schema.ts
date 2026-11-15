import { z } from "zod";
import type { RealtimeInterestState } from "@/features/realtime/types";

export const stockIdSchema = z.string().max(255).refine((id) => id.trim().length > 0);
export const stockSnapshotsSchema = z.object({
	products: z.array(z.object({ productId: stockIdSchema, stock: z.number().int().nonnegative() })),
	variants: z.array(z.object({
		variantId: stockIdSchema,
		productId: stockIdSchema,
		stock: z.number().int().nonnegative(),
		stockRevision: z.number().int().nonnegative(),
	})),
});
export type StockSnapshots = z.infer<typeof stockSnapshotsSchema>;
export type StockSnapshotInterest =
	| { kind: "product"; productId: string }
	| { kind: "variant"; productId: string; variantId: string };
export type StockSnapshotState = Readonly<{
	stock: number | null;
	stockRevision: number | null;
	loading: boolean;
	error: unknown | null;
	omitted: boolean;
	readiness: RealtimeInterestState;
}>;
