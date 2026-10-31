import { z } from "zod";

import {
	createPageResponseSchema,
	OrderStatusSchema,
	PaymentMethodSchema,
	PaymentStatusSchema,
} from "@/lib/api/schema";

/**
 * Order DTO schemas, mirroring the backend records under
 * `dto/response/order/*`. Items and payment are enriched by the backend, so
 * defaults keep older payloads readable during a rolling deploy.
 */
export const OrderItemSchema = z.object({
	orderId: z.string(),
	variantId: z.string(),
	sku: z.string(),
	quantity: z.number().int().positive(),
	unitPrice: z.number(),
	createdAt: z.string(),
	productName: z.string().nullable().default(null),
	thumbnail: z.string().nullable().default(null),
	attributes: z.array(z.string()).default([]),
});

export const OrderPaymentSchema = z.object({
	method: PaymentMethodSchema,
	status: PaymentStatusSchema,
	transactionId: z.string().nullable(),
	paidAt: z.string().nullable(),
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
	payment: OrderPaymentSchema.nullable().default(null),
});

export const OrderPageSchema = createPageResponseSchema(OrderSchema);

export { PaymentStatusSchema };
