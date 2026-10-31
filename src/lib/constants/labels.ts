import type {
	AdminStatus,
	EmployeeStatus,
	NotificationStatus,
	NotificationType,
	OrderStatus,
	PaymentMethod,
	PaymentStatus,
	ProductStatus,
	UserStatus,
} from "@/types";

// Admin
export const ADMIN_STATUS_LABELS: Record<AdminStatus, string> = {
	ACTIVE: "Active",
	INACTIVE: "Inactive",
};

// Employee
export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
	ACTIVE: "Active",
	INACTIVE: "Inactive",
};

// Notification
export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
	UNREAD: "Unread",
	READ: "Read",
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
	ORDER: "Order",
	PROMOTION: "Promotion",
	SYSTEM: "System",
};

// Order
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
	PENDING: "Pending",
	CONFIRMED: "Confirmed",
	SHIPPING: "Shipping",
	COMPLETED: "Completed",
	CANCELLED: "Cancelled",
};

// Payment
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
	CREDIT_CARD: "Credit card",
	DEBIT_CARD: "Debit card",
	BANK_TRANSFER: "Bank transfer",
	E_WALLET: "E-wallet",
	COD: "Cash on delivery",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
	PENDING: "Pending",
	CONFIRMED: "Confirmed",
	FAILED: "Failed",
	REFUNDED: "Refunded",
	REFUND_REQUIRED: "Refund required",
};

// Product
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
	DRAFT: "Draft",
	ACTIVE: "Active",
	INACTIVE: "Inactive",
	DELETED: "Deleted",
};

// User
export const USER_STATUS_LABELS: Record<UserStatus, string> = {
	ACTIVE: "Active",
	LOCKED: "Locked",
	DELETED: "Deleted",
};
