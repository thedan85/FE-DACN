import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGhnProvinces, getGhnWards, type GhnOption } from "../api/shipping.api";
import { useGhnAddress } from "./use-ghn-address";

vi.mock("../api/shipping.api", () => ({
	getGhnProvinces: vi.fn(),
	getGhnWards: vi.fn(),
}));

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("useGhnAddress", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("reports an error when the province list is empty", async () => {
		vi.mocked(getGhnProvinces).mockResolvedValue([]);

		const { result } = renderHook(() => useGhnAddress(null));

		await waitFor(() => {
			expect(result.current.loadingProvinces).toBe(false);
		});
		expect(result.current.provinces).toEqual([]);
		expect(result.current.error).toBe(
			"No delivery provinces are available right now.",
		);
		expect(getGhnWards).not.toHaveBeenCalled();
	});

	it("reports an error when the selected province has no wards", async () => {
		vi.mocked(getGhnProvinces).mockResolvedValue([{ id: 1, name: "Province A" }]);
		vi.mocked(getGhnWards).mockResolvedValue([]);

		const { result } = renderHook(() => useGhnAddress(1));

		await waitFor(() => {
			expect(result.current.loadingWards).toBe(false);
		});
		expect(result.current.wards).toEqual([]);
		expect(result.current.error).toBe(
			"No wards are available for this province.",
		);
	});

	it("reloads provinces and the selected province's wards after a failure", async () => {
		vi.mocked(getGhnProvinces)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue([{ id: 1, name: "Province A" }]);
		vi.mocked(getGhnWards)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue([{ id: 11, name: "Ward A" }]);

		const { result } = renderHook(() => useGhnAddress(1));

		await waitFor(() => {
			expect(result.current.error).not.toBeNull();
		});
		expect(getGhnProvinces).toHaveBeenCalledTimes(1);
		expect(getGhnWards).toHaveBeenCalledTimes(1);

		act(() => {
			result.current.reload();
		});

		await waitFor(() => {
			expect(result.current.wards).toEqual([{ id: 11, name: "Ward A" }]);
		});
		expect(result.current.error).toBeNull();
		expect(getGhnProvinces).toHaveBeenCalledTimes(2);
		expect(getGhnWards).toHaveBeenCalledTimes(2);
	});

	it("keeps the ward error when the province request succeeds during the same reload", async () => {
		vi.mocked(getGhnProvinces).mockResolvedValue([{ id: 1, name: "Province A" }]);
		vi.mocked(getGhnWards).mockResolvedValue([{ id: 11, name: "Ward A" }]);

		const { result } = renderHook(() => useGhnAddress(1));
		await waitFor(() => {
			expect(result.current.wards).toEqual([{ id: 11, name: "Ward A" }]);
		});

		const provincesRetry = deferred<GhnOption[]>();
		vi.mocked(getGhnProvinces).mockReturnValueOnce(provincesRetry.promise);
		vi.mocked(getGhnWards).mockRejectedValueOnce(new Error("offline"));

		act(() => {
			result.current.reload();
		});

		await waitFor(() => {
			expect(result.current.error).toBe(
				"Could not load wards. Please try again.",
			);
		});
		expect(result.current.loadingProvinces).toBe(true);

		await act(async () => {
			provincesRetry.resolve([{ id: 1, name: "Province A" }]);
		});
		await waitFor(() => {
			expect(result.current.loadingProvinces).toBe(false);
		});
		expect(result.current.error).toBe(
			"Could not load wards. Please try again.",
		);
	});

	it("keeps the province error when the ward request succeeds during the same reload", async () => {
		vi.mocked(getGhnProvinces).mockResolvedValue([{ id: 1, name: "Province A" }]);
		vi.mocked(getGhnWards).mockResolvedValue([{ id: 11, name: "Ward A" }]);

		const { result } = renderHook(() => useGhnAddress(1));
		await waitFor(() => {
			expect(result.current.wards).toEqual([{ id: 11, name: "Ward A" }]);
		});

		const wardsRetry = deferred<GhnOption[]>();
		vi.mocked(getGhnProvinces).mockRejectedValueOnce(new Error("offline"));
		vi.mocked(getGhnWards).mockReturnValueOnce(wardsRetry.promise);

		act(() => {
			result.current.reload();
		});

		await waitFor(() => {
			expect(result.current.error).toBe(
				"Could not load provinces. Please try again.",
			);
		});

		await act(async () => {
			wardsRetry.resolve([{ id: 11, name: "Ward A" }]);
		});
		await waitFor(() => {
			expect(result.current.wards).toEqual([{ id: 11, name: "Ward A" }]);
		});
		expect(result.current.error).toBe(
			"Could not load provinces. Please try again.",
		);
	});

	it("ignores a stale ward response after the province changes", async () => {
		const wardsA = deferred<GhnOption[]>();
		const wardsB = deferred<GhnOption[]>();
		vi.mocked(getGhnProvinces).mockResolvedValue([
			{ id: 1, name: "Province A" },
			{ id: 2, name: "Province B" },
		]);
		vi.mocked(getGhnWards).mockImplementation((provinceId) =>
			provinceId === 1 ? wardsA.promise : wardsB.promise,
		);

		const { result, rerender } = renderHook(
			({ provinceId }: { provinceId: number | null }) =>
				useGhnAddress(provinceId),
			{ initialProps: { provinceId: 1 } },
		);

		await waitFor(() => {
			expect(getGhnWards).toHaveBeenCalledWith(1);
		});

		rerender({ provinceId: 2 });
		await waitFor(() => {
			expect(getGhnWards).toHaveBeenCalledWith(2);
		});

		await act(async () => {
			wardsB.resolve([{ id: 21, name: "Ward B" }]);
		});
		await waitFor(() => {
			expect(result.current.wards).toEqual([{ id: 21, name: "Ward B" }]);
			expect(result.current.loadingWards).toBe(false);
		});

		await act(async () => {
			wardsA.resolve([{ id: 11, name: "Ward A" }]);
		});
		await waitFor(() => {
			expect(result.current.wards).toEqual([{ id: 21, name: "Ward B" }]);
		});
	});
});
