import type { z } from "zod";

import {
	AdminStatusSchema,
	EmployeeStatusSchema,
	NotificationStatusSchema,
	NotificationTypeSchema,
	OrderStatusSchema,
	PaymentMethodSchema,
	PaymentStatusSchema,
	ProductStatusSchema,
	UserStatusSchema,
} from "@/lib/api/schema";

// Admin
export type AdminStatus = z.infer<typeof AdminStatusSchema>;

// Employee
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>;

// Notification
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

// Order
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// Payment
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

// Product
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

// User
export type UserStatus = z.infer<typeof UserStatusSchema>;
