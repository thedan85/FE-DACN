import { describe, expect, it } from "vitest";
import { reconnectDelay } from "./backoff";

describe("reconnectDelay", () => {
	it("follows 1, 2, 4, 8, 16, 30 seconds without jitter", () => {
		const delays = [0, 1, 2, 3, 4, 5, 9].map((attempt) =>
			reconnectDelay(attempt, () => 0),
		);

		expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
	});

	it("adds at most 25 percent and never subtracts", () => {
		for (const attempt of [0, 1, 5]) {
			expect(reconnectDelay(attempt, () => 0.999)).toBeLessThanOrEqual(
				reconnectDelay(attempt, () => 0) * 1.25,
			);
			expect(reconnectDelay(attempt, () => 0)).toBeGreaterThan(0);
		}
	});
});
