"use client";

import { Tag } from "antd";

import { effectiveStock } from "../model/effective-stock";
import { useStockSnapshot } from "../use-stock-snapshot";
import type { StockSnapshotInterest } from "../schema";

type StockAvailabilityProps = {
	interest: StockSnapshotInterest;
	/** Server-rendered DTO value; used before and whenever live data is unusable. */
	serverStock: number | null | undefined;
	className?: string;
};

/**
 * Small client island for the only mutable part of a server-rendered card: the
 * availability tag. SSR renders the DTO state; the shared hook then overlays
 * live snapshot values. No per-card HTTP — registrations coalesce into the
 * shared store's batched snapshot.
 */
export function StockAvailability({
	interest,
	serverStock,
	className,
}: StockAvailabilityProps) {
	const snapshot = useStockSnapshot(interest);
	const stock = effectiveStock(snapshot, serverStock);

	if (stock === 0) {
		return <Tag className={className}>Out of stock</Tag>;
	}
	return null;
}
