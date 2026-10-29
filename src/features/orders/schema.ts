import { z } from "zod";

import { OrderStatusSchema } from "@/lib/api/schema";

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

export type OrderItem = z.infer<typeof OrderItemSchema>;
export type Order = z.infer<typeof OrderSchema>;
