import { expect, it } from "vitest";

import { RevenueForecastResponseSchema } from "./revenue-forecast.schema";

const fixture = {
	generatedAt: "2026-11-23T10:00:00+07:00",
	model: "Prophet",
	trainingMonths: 36,
	holdoutMonths: 6,
	mae: 167965.57,
	mape: 2.13,
	months: [
		{
			date: "2026-11-01",
			predicted: 10356310.87,
			lower: 10189870.2,
			upper: 10510301.47,
		},
		{
			date: "2026-12-01",
			predicted: 10277874.56,
			lower: 10120610.6,
			upper: 10431973.52,
		},
	],
	annual: [
		{
			year: 2026,
			months: 2,
			predicted: 20634185.43,
			lower: 20310480.8,
			upper: 20942274.99,
		},
		{
			year: 2027,
			months: 12,
			predicted: 100000000,
			lower: 90000000,
			upper: 110000000,
		},
	],
};

it("accepts the exact contract fixture", () => {
	const result = RevenueForecastResponseSchema.safeParse({
		code: 200,
		message: "OK",
		data: fixture,
	});

	expect(result.success).toBe(true);
	if (result.success) {
		expect(result.data.data.months).toHaveLength(2);
		expect(result.data.data.annual[0].months).toBe(2);
	}
});

it("rejects inverted interval bounds", () => {
	const invalid = {
		...fixture,
		months: [{ ...fixture.months[0], lower: fixture.months[0].predicted + 1 }],
	};

	const result = RevenueForecastResponseSchema.safeParse({
		code: 200,
		message: "OK",
		data: invalid,
	});

	expect(result.success).toBe(false);
});
