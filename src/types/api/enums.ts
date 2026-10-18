
import { z } from "zod";

// Admin
export const AdminStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type AdminStatus = z.infer<typeof AdminStatusSchema>;

// Employee
export const EmployeeStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>;

// Notification
export const NotificationStatusSchema = z.enum(["UNREAD", "READ"]);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

export const NotificationTypeSchema = z.enum([
	"ORDER",
	"PROMOTION",
	"SYSTEM",
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

// Order
export const OrderStatusSchema = z.enum([
	"PENDING",
	"CONFIRMED",
	"SHIPPING",
	"COMPLETED",
	"CANCELLED",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// Payment
export const PaymentMethodSchema = z.enum([
	"CREDIT_CARD",
	"DEBIT_CARD",
	"BANK_TRANSFER",
	"E_WALLET",
	"COD",
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentStatusSchema = z.enum([
	"PENDING",
	"CONFIRMED",
	"FAILED",
	"REFUNDED",
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

// Product
export const ProductStatusSchema = z.enum([
	"DRAFT",
	"ACTIVE",
	"INACTIVE",
	"DELETED",
]);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

// User
export const UserStatusSchema = z.enum([
	"ACTIVE",
	"LOCKED",
	"DELETED",
]);
export type UserStatus = z.infer<typeof UserStatusSchema>;
