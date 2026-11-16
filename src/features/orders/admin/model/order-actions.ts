import type { OrderStatus } from "@/types";

import {
	hasOrderPermission,
	ORDER_PERMISSIONS,
} from "./order-permissions";

export type OrderAction = "accept" | "reject" | "complete";

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
