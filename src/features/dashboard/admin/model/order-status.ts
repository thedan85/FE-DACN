import type { OrderStatus } from "@/types";

/** Dashboard labels follow the admin mockup, not the storefront's friendlier wording. */
export const DASHBOARD_ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
	PENDING: "Pending",
	CONFIRMED: "Confirmed",
	SHIPPING: "Shipping",
	COMPLETED: "Completed",
	CANCELLED: "Cancelled",
};

/** Legend order from the design: strongest outcome first, cancelled last. */
export const DASHBOARD_ORDER_STATUS_ORDER: OrderStatus[] = [
	"COMPLETED",
	"SHIPPING",
	"CONFIRMED",
	"PENDING",
	"CANCELLED",
];
