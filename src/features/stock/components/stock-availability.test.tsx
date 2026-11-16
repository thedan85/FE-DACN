import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StockSnapshotState } from "../schema";
import { StockAvailability } from "./stock-availability";

const { useStockSnapshotMock } = vi.hoisted(() => ({ useStockSnapshotMock: vi.fn() }));
vi.mock("../use-stock-snapshot", () => ({ useStockSnapshot: useStockSnapshotMock }));

const admitted = { admission: "admitted", acknowledged: true, status: "live" } as const;
const initial = (): StockSnapshotState => ({
	stock: null, stockRevision: null, loading: false, error: null, omitted: false,
	readiness: { admission: "unavailable", acknowledged: false, status: "degraded" },
});
const live = (stock: number): StockSnapshotState => ({ ...initial(), stock, readiness: admitted });

const interest = { kind: "variant", productId: "PRD_1", variantId: "VAR_1" } as const;

beforeEach(() => { useStockSnapshotMock.mockReset().mockReturnValue(initial()); });
afterEach(() => { cleanup(); });

describe("StockAvailability client island", () => {
	it("renders the DTO state on the server pass before any live value exists", () => {
		render(<StockAvailability interest={interest} serverStock={0} />);
		expect(screen.getByText("Out of stock")).toBeTruthy();
	});

	it("shows no stock claim for an unknown DTO and no live snapshot", () => {
		render(<StockAvailability interest={interest} serverStock={null} />);
		expect(screen.queryByText("Out of stock")).toBeNull();
	});

	it("mutates to sold out when a live zero arrives, then clears when stock rises", () => {
		const { rerender } = render(<StockAvailability interest={interest} serverStock={5} />);
		expect(screen.queryByText("Out of stock")).toBeNull();
		useStockSnapshotMock.mockReturnValue(live(0));
		rerender(<StockAvailability interest={interest} serverStock={5} />);
		expect(screen.getByText("Out of stock")).toBeTruthy();
		useStockSnapshotMock.mockReturnValue(live(3));
		rerender(<StockAvailability interest={interest} serverStock={5} />);
		expect(screen.queryByText("Out of stock")).toBeNull();
	});

	it("falls back to the DTO value while live data is loading, errored or omitted", () => {
		for (const state of [
			{ ...live(0), loading: true },
			{ ...live(0), error: new Error("offline") },
			{ ...initial(), omitted: true },
		]) {
			useStockSnapshotMock.mockReturnValue(state);
			const view = render(<StockAvailability interest={interest} serverStock={0} />);
			expect(screen.getByText("Out of stock")).toBeTruthy();
			view.unmount();
		}
	});
});
