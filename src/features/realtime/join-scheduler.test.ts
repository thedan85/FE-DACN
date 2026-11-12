import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinScheduler } from "./join-scheduler";

describe("JoinScheduler", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("spaces joins at 0, 500, and 1000 ms", async () => {
		vi.useFakeTimers();
		let now = 0;
		const scheduler = new JoinScheduler(() => now);

		await scheduler.acquire();

		let second = false;
		void scheduler.acquire().then(() => {
			second = true;
		});
		await vi.advanceTimersByTimeAsync(499);
		expect(second).toBe(false);
		now = 500;
		await vi.advanceTimersByTimeAsync(1);
		expect(second).toBe(true);

		let third = false;
		void scheduler.acquire().then(() => {
			third = true;
		});
		await vi.advanceTimersByTimeAsync(499);
		expect(third).toBe(false);
		now = 1000;
		await vi.advanceTimersByTimeAsync(1);
		expect(third).toBe(true);
	});

	it("reserves distinct slots for concurrent acquires", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const scheduler = new JoinScheduler(() => Date.now());
		const grantedAt: number[] = [];

		void scheduler.acquire().then(() => grantedAt.push(Date.now()));
		void scheduler.acquire().then(() => grantedAt.push(Date.now()));
		void scheduler.acquire().then(() => grantedAt.push(Date.now()));

		await vi.advanceTimersByTimeAsync(0);
		expect(grantedAt).toEqual([0]);
		await vi.advanceTimersByTimeAsync(499);
		expect(grantedAt).toEqual([0]);
		await vi.advanceTimersByTimeAsync(1);
		expect(grantedAt).toEqual([0, 500]);
		await vi.advanceTimersByTimeAsync(500);
		expect(grantedAt).toEqual([0, 500, 1000]);
	});

	it("keeps the interval when a timer fires late", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		let offset = 0;
		const scheduler = new JoinScheduler(() => Date.now() + offset);
		await scheduler.acquire();

		const secondAt: number[] = [];
		const thirdAt: number[] = [];
		void scheduler.acquire().then(() => secondAt.push(Date.now() + offset));
		await vi.advanceTimersByTimeAsync(0);
		offset = 400;
		await vi.advanceTimersByTimeAsync(500);
		expect(secondAt).toEqual([900]);

		void scheduler.acquire().then(() => thirdAt.push(Date.now() + offset));
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(100);
		expect(thirdAt).toEqual([]);
		await vi.advanceTimersByTimeAsync(400);
		expect(thirdAt).toEqual([1400]);
	});
});
