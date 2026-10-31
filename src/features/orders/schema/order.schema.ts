import { z } from "zod";

import {
	createPageResponseSchema,
	OrderStatusSchema,
} from "@/lib/api/schema";

/**
 * Order DTO schemas, mirroring the backend records under
 * `dto/response/order/*` (verified against backend `dev` @ `f758bae`).
 */
export const OrderItemSchema = z.object({
	orderId: z.string(),
	variantId: z.string(),
	sku: z.string(),
	quantity: z.number().int().positive(),
	unitPrice: z.number(),
	createdAt: z.string(),
});

export const OrderSchema = z.object({
	orderId: z.string(),
	customerId: z.string(),
	customerName: z.string(),
	status: OrderStatusSchema,
	total: z.number(),
	address: z.string(),
	recipientName: z.string(),
	phone: z.string(),
	items: z.array(OrderItemSchema),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const OrderPageSchema = createPageResponseSchema(OrderSchema);

/** The payment DTO adds `REFUND_REQUIRED` to the shared status enum. */
export const PaymentStatusSchema = z.enum([
	"PENDING",
	"CONFIRMED",
	"FAILED",
	"REFUNDED",
	"REFUND_REQUIRED",
]);
