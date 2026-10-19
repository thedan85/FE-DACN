
import { z } from "zod";

// Admin
export const AdminStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

// Employee
export const EmployeeStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

// Notification
export const NotificationStatusSchema = z.enum(["UNREAD", "READ"]);

export const NotificationTypeSchema = z.enum([
	"ORDER",
	"PROMOTION",
	"SYSTEM",
]);

// Order
export const OrderStatusSchema = z.enum([
	"PENDING",
	"CONFIRMED",
	"SHIPPING",
	"COMPLETED",
	"CANCELLED",
]);

// Payment
export const PaymentMethodSchema = z.enum([
	"CREDIT_CARD",
	"DEBIT_CARD",
	"BANK_TRANSFER",
	"E_WALLET",
	"COD",
]);

export const PaymentStatusSchema = z.enum([
	"PENDING",
	"CONFIRMED",
	"FAILED",
	"REFUNDED",
]);

// Product
export const ProductStatusSchema = z.enum([
	"DRAFT",
	"ACTIVE",
	"INACTIVE",
	"DELETED",
]);

// User
export const UserStatusSchema = z.enum([
	"ACTIVE",
	"LOCKED",
	"DELETED",
]);