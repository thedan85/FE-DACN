import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import type { RevenueForecast } from "../types";
import { RevenueForecastPanel } from "./revenue-forecast-panel";

afterEach(() => {
	cleanup();
});

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
	expect(screen.getByRole("group", { name: /forecast/i })).toBeTruthy();
	expect(screen.getByRole("img", { name: /Nov 2026/ })).toBeTruthy();
	expect(screen.getByText("2026 (partial)")).toBeTruthy();
	expect(screen.getByText("2027")).toBeTruthy();
	expect(screen.getByText(/Generated 10:00 ICT/)).toBeTruthy();
});

it("renders unavailable MAPE as n/a", () => {
	render(<RevenueForecastPanel forecast={{ ...forecast, mape: null }} />);

	expect(screen.getByText(/MAPE n\/a/)).toBeTruthy();
});

it("does not crash on malformed generatedAt or month dates", () => {
	render(
		<RevenueForecastPanel
			forecast={{
				...forecast,
				generatedAt: "not-a-date",
				months: [{ ...forecast.months[0], date: "nope" }],
			}}
		/>,
	);

	expect(screen.getByText(/Generated time unavailable/)).toBeTruthy();
	expect(screen.getByRole("group", { name: /forecast/i })).toBeTruthy();
});

it("shows tooltip on point hover", () => {
	render(<RevenueForecastPanel forecast={forecast} />);

	const points = screen.getAllByTestId("forecast-point");
	fireEvent.mouseEnter(points[0]);

	const tooltip = screen.getByTestId("forecast-tooltip");
	expect(tooltip.textContent).toContain("Nov 2026");
	expect(tooltip.textContent).toMatch(/10\.356\.311/);
	expect(tooltip.textContent).toContain("80%");
});

it("shows tooltip on keyboard focus and clears on Escape", () => {
	render(<RevenueForecastPanel forecast={forecast} />);

	const points = screen.getAllByTestId("forecast-point");
	fireEvent.focus(points[0]);
	expect(screen.getByTestId("forecast-tooltip").textContent).toContain("Nov 2026");

	fireEvent.keyDown(points[0], { key: "Escape" });
	expect(screen.queryByTestId("forecast-tooltip")).toBeNull();
});

it("renders a 12-row monthly table", () => {
	const months = Array.from({ length: 12 }, (_, index) => ({
		...forecast.months[0],
		date: `2026-${String(index + 1).padStart(2, "0")}-01`,
	}));

	render(<RevenueForecastPanel forecast={{ ...forecast, months }} />);

	const table = screen.getByRole("table", { name: /monthly revenue forecast/i });

	expect(within(table).getAllByRole("row")).toHaveLength(13);
	expect(within(table).getByText("Jan 2026")).toBeTruthy();
	expect(within(table).getAllByText(/10\.356\.311/)).toHaveLength(12);
});
