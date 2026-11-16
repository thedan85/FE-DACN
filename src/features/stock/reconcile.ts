"use client";

import { stockStore } from "./store";

/**
 * Force one fresh server snapshot after a rejected checkout.
 *
 * The realtime signal itself remains an invalidation hint only; this is an
 * explicit reread of the authoritative server state, not a delta or a payment
 * authority. Callers keep their form and cart values while it runs.
 */
export function reconcileStock(): void {
	void stockStore.reconcile();
}
