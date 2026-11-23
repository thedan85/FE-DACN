import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import type { RevenueForecast } from "../types";
import { RevenueForecastPanel } from "./revenue-forecast-panel";

const forecast: RevenueForecast = {
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

it("renders monthly points, partial-year labels, and generated time", () => {
	render(<RevenueForecastPanel forecast={forecast} />);

	expect(screen.getByText("Revenue forecast")).toBeTruthy();
	expect(screen.getByRole("img", { name: /forecast/i })).toBeTruthy();
	expect(screen.getByText("2026 (partial)")).toBeTruthy();
	expect(screen.getByText("2027")).toBeTruthy();
	expect(screen.getByText(/Generated 10:00 ICT/)).toBeTruthy();
});
