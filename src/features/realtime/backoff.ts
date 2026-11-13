const BASE_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

export function reconnectDelay(
	attempt: number,
	random: () => number = Math.random,
): number {
	const base = BASE_DELAYS_MS[Math.min(Math.max(attempt, 0), BASE_DELAYS_MS.length - 1)];

	return Math.round(base * (1 + random() * 0.25));
}
