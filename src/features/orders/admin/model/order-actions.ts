import type { OrderStatus } from "@/types";

/**
 * Mirrored from `Permissions.java` in the backend repo. The backend enforces
 * these permissions; the frontend only reflects them in the action menu.
 */
export const ORDER_PERMISSIONS = {
	read: "order:read",
	update: "order:update",
	complete: "order:complete",
} as const;

export type OrderPermission =
	(typeof ORDER_PERMISSIONS)[keyof typeof ORDER_PERMISSIONS];

export type OrderAction = "accept" | "reject" | "complete";

export function hasOrderPermission(
	permissions: readonly string[] | null | undefined,
	permission: OrderPermission,
): boolean {
	return permissions != null && permissions.includes(permission);
}

/** Which actions the signed-in account may take on this order. */
export function getOrderActions(
	status: OrderStatus,
	permissions: readonly string[] | null | undefined,
): OrderAction[] {
	const canUpdate = hasOrderPermission(permissions, ORDER_PERMISSIONS.update);
	const canComplete = hasOrderPermission(
		permissions,
		ORDER_PERMISSIONS.complete,
	);
	const actions: OrderAction[] = [];

	if (status === "PENDING" && canUpdate) {
		actions.push("accept", "reject");
	}

	if (status !== "CANCELLED" && status !== "COMPLETED" && canComplete) {
		actions.push("complete");
	}

	return actions;
}
