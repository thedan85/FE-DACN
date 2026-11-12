import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { CartCompatibility } from "../../types";
import { CompatibilityCard } from "./compatibility-card";

afterEach(cleanup);

const safe: CartCompatibility = {
	verdict: "SAFE",
	summary: "Selected species share compatible water parameters and behavior.",
	checks: [],
	recommendedTankLitres: 75,
};

describe("CompatibilityCard", () => {
	it("renders a safe verdict without the old guarantee copy", () => {
		render(<CompatibilityCard compatibility={safe} />);

		expect(screen.getByText("Compatible")).toBeTruthy();
		expect(screen.getByText(safe.summary)).toBeTruthy();
		expect(screen.queryByText("100% Cohabitation Safe")).toBeNull();
	});

	it("renders caution reasons and the tank recommendation", () => {
		render(
			<CompatibilityCard
				compatibility={{
					...safe,
					verdict: "CAUTION",
					summary: "Some species need monitoring before cohabitation.",
					checks: [
						{
							code: "TEMPERATURE",
							status: "WARN",
							message: "Shared temperature range is only 24-26 °C.",
						},
					],
					recommendedTankLitres: 200,
				}}
			/>,
		);

		expect(screen.getByText("Caution")).toBeTruthy();
		expect(
			screen.getByText("Shared temperature range is only 24-26 °C."),
		).toBeTruthy();
		expect(
			screen.getByText("Recommended tank: 200 L or larger."),
		).toBeTruthy();
	});

	it("renders the unknown state without claiming safety", () => {
		render(
			<CompatibilityCard
				compatibility={{
					...safe,
					verdict: "UNKNOWN",
					summary: "Not enough trait data to confirm compatibility.",
					checks: [],
					recommendedTankLitres: null,
				}}
			/>,
		);

		expect(screen.getByText("Not Enough Data")).toBeTruthy();
	});
});
