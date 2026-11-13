/**
 * One budget shared by initial joins and rejoin retries: at most two joins per
 * rolling second, spaced 500 ms apart so a retry cannot burst past it.
 * Acquires run one at a time, so a delayed timer cannot compress the next gap.
 */
export class JoinScheduler {
	private lastJoinAt = Number.NEGATIVE_INFINITY;
	private tail: Promise<void> = Promise.resolve();

	constructor(
		private readonly now: () => number = Date.now,
		private readonly minIntervalMs = 500,
	) {}

	async acquire(isActive: () => boolean = () => true): Promise<void> {
		const previous = this.tail;
		let release!: () => void;
		this.tail = new Promise<void>((resolve) => {
			release = resolve;
		});
		await previous;
		try {
			if (!isActive()) {
				return;
			}
			const wait = Math.max(
				0,
				this.lastJoinAt + this.minIntervalMs - this.now(),
			);
			if (wait > 0) {
				await new Promise<void>((resolve) => setTimeout(resolve, wait));
			}
			if (!isActive()) {
				return;
			}
			this.lastJoinAt = this.now();
		} finally {
			release();
		}
	}
}
