import type { z } from "zod";

import type {
	OrderItemSchema,
	OrderPageSchema,
	OrderPaymentSchema,
	OrderSchema,
	PaymentStatusSchema,
} from "../schema/order.schema";

/** Order DTO types (single source: `../schema/order.schema.ts`). */

export type OrderItem = z.infer<typeof OrderItemSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type OrderPage = z.infer<typeof OrderPageSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type OrderPayment = z.infer<typeof OrderPaymentSchema>;

export type OrderItemView = OrderItem & {
	productName: string | null;
	thumbnail: string | null;
	attributes: string[];
};

export type OrderView = Omit<Order, "items"> & {
	items: OrderItemView[];
	payment: OrderPayment | null;
};
