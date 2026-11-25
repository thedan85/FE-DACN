import { z } from "zod";

export const AdminReviewSchema = z.object({
	reviewId: z.string(),
	customerId: z.string(),
	customerName: z.string(),
	rating: z.number().int().min(1).max(5),
	comment: z.string(),
	productId: z.string(),
	productName: z.string(),
	variantId: z.string(),
	variantSku: z.string(),
	verifiedPurchase: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type AdminReview = z.infer<typeof AdminReviewSchema>;
