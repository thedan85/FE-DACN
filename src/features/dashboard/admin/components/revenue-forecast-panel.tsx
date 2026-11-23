"use client";

import { useMemo } from "react";

import {
	formatVndPrice,
	STORE_TIME_ZONE,
} from "@/features/products/storefront/model/product-format";

import type { RevenueForecast } from "../types";
import styles from "./dashboard-view.module.css";

type RevenueForecastPanelProps = {
	forecast: RevenueForecast;
};

const compactFormatter = new Intl.NumberFormat("vi-VN", {
	maximumFractionDigits: 1,
});
const monthFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	timeZone: "Asia/Ho_Chi_Minh",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
	timeZone: STORE_TIME_ZONE,
});

function safeDate(value: string): Date | null {
	const parsed = new Date(value);

	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthLabel(value: string | undefined): string {
	if (!value) return "";
	const date = safeDate(`${value}T00:00:00Z`);

	return date ? monthFormatter.format(date) : "—";
}

function compactVnd(value: number): string {
	if (value >= 1_000_000_000) {
		return `${compactFormatter.format(value / 1_000_000_000)} tỷ`;
	}
	if (value >= 1_000_000) {
		return `${compactFormatter.format(value / 1_000_000)} tr`;
	}

	return String(Math.round(value));
}

function niceCeiling(value: number): number {
	const magnitude = 10 ** Math.floor(Math.log10(value));
	const normalized = value / magnitude;
	const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

	return step * magnitude;
}

/**
 * Prophet forecast as a small SVG chart. The interval band and line share one
 * scale, so the shaded range is readable without a charting dependency.
 */
export function RevenueForecastPanel({ forecast }: RevenueForecastPanelProps) {
	const months = forecast.months;
	const max = useMemo(() => {
		const highest = Math.max(...months.map((point) => point.upper), 0);

		return highest === 0 ? 1 : niceCeiling(highest);
	}, [months]);

	const { linePath, bandPath } = useMemo(() => {
		const x = (index: number) =>
			months.length === 1 ? 500 : (index / (months.length - 1)) * 1000;
		const y = (value: number) => 100 - (value / max) * 100;
		const line = months
			.map((point, index) => {
				const command = index === 0 ? "M" : "L";

				return `${command}${x(index).toFixed(2)},${y(point.predicted).toFixed(2)}`;
			})
			.join(" ");
		const upper = months.map((point, index) =>
			`${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(point.upper).toFixed(2)}`,
		);
		const lower = months
			.map((point, index) =>
				`L${x(months.length - 1 - index).toFixed(2)},${y(
					months[months.length - 1 - index].lower,
				).toFixed(2)}`,
			)
			.join(" ");

		return { linePath: line, bandPath: `${upper.join(" ")} ${lower} Z` };
	}, [max, months]);

	const labelIndexes = useMemo(() => {
		if (months.length <= 4) {
			return months.map((_, index) => index);
		}

		return [
			0,
			Math.round((months.length - 1) / 3),
			Math.round(((months.length - 1) * 2) / 3),
			months.length - 1,
		];
	}, [months.length]);

	const generatedDate = safeDate(forecast.generatedAt);
	const generatedTime = generatedDate ? timeFormatter.format(generatedDate) : "time unavailable";
	const mape = forecast.mape === null ? "n/a" : `${forecast.mape.toFixed(1)}%`;

	return (
		<section className={styles.panel} aria-labelledby="forecast-title">
			<div className={styles.panelHeader}>
				<div className={styles.panelTitleBlock}>
					<h2 id="forecast-title" className={styles.panelTitle}>
						Revenue forecast
					</h2>
					<p className={styles.panelSubtitle}>
						{forecast.model} · next {months.length} months · VND
					</p>
				</div>
			</div>

			<div
				className={styles.chart}
				role="img"
				aria-label="Prophet monthly revenue forecast with 80% interval"
			>
				<div className={styles.chartBody}>
					<div className={styles.yAxis} aria-hidden="true">
						<span>{compactVnd(max)}</span>
						<span>{compactVnd((max * 2) / 3)}</span>
						<span>{compactVnd(max / 3)}</span>
						<span>0</span>
					</div>

					<div className={styles.plot}>
						<span className={styles.gridLine} aria-hidden="true" />
						<span className={styles.gridLine} aria-hidden="true" />
						<span className={styles.gridLine} aria-hidden="true" />
						<span className={styles.gridLine} aria-hidden="true" />
						{months.length > 0 && (
							<svg
								className={styles.chartSvg}
								viewBox="0 0 1000 100"
								preserveAspectRatio="none"
								aria-hidden="true"
							>
								<path className={styles.forecastBand} d={bandPath} />
								<path
									className={styles.forecastLine}
									d={linePath}
									vectorEffect="non-scaling-stroke"
								/>
							</svg>
						)}
					</div>
				</div>

				<div className={styles.xAxis} aria-hidden="true">
					{labelIndexes.map((index) => (
						<span key={months[index]?.date ?? index}>
							{monthLabel(months[index]?.date)}
						</span>
					))}
				</div>
			</div>

			<div className={styles.forecastAnnual}>
				{forecast.annual.map((total) => (
					<div className={styles.forecastAnnualRow} key={total.year}>
						<span className={styles.forecastYear}>
							{total.year}
							{total.months < 12 ? " (partial)" : ""}
						</span>
						<span>{formatVndPrice(total.predicted)}</span>
					</div>
				))}
			</div>

			<p className={styles.panelFooter}>
				Generated {generatedTime} ICT · MAE {formatVndPrice(forecast.mae)} · MAPE{" "}
				{mape}
			</p>
		</section>
	);
}
