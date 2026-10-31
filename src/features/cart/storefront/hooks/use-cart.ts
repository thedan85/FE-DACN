"use client";

import { useCallback, useEffect, useState } from "react";

import { getAuthErrorMessage } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/stores/auth-store";

import { getCart } from "../../api/cart.api";
import type { Cart } from "../../types";

type LoadState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "ready"; cart: Cart };

export type CartState = LoadState | { status: "anonymous" };

/**
 * Loads the authenticated customer's cart once the auth store finishes
 * hydrating. `setCart` lets the view apply confirmed mutation responses
 * without a second round trip; `reload` re-fetches after an error.
 */
export function useCart() {
	const { status, hydrate } = useAuthStore();
	const [load, setLoad] = useState<LoadState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);

	useEffect(() => {
		void hydrate();
	}, [hydrate]);

	useEffect(() => {
		if (status !== "authenticated") {
			return;
		}

		let active = true;

		getCart()
			.then((cart) => {
				if (active) {
					setLoad({ status: "ready", cart });
				}
			})
			.catch((error: unknown) => {
				if (active) {
					setLoad({
						status: "error",
						message: getAuthErrorMessage(error),
					});
				}
			});

		return () => {
			active = false;
		};
	}, [status, reloadKey]);

	const reload = useCallback(() => {
		setLoad({ status: "loading" });
		setReloadKey((current) => current + 1);
	}, []);

	const setCart = useCallback((cart: Cart) => {
		setLoad({ status: "ready", cart });
	}, []);

	const state: CartState =
		status === "anonymous" ? { status: "anonymous" } : load;

	return { state, reload, setCart };
}
