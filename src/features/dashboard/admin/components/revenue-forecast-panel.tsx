"use client";

import { useMemo, useState } from "react";

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
const monthYearFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	year: "numeric",
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

function monthYearLabel(value: string | undefined): string {
	if (!value) return "";
	const date = safeDate(`${value}T00:00:00Z`);

	return date ? monthYearFormatter.format(date) : "—";
}

function chartX(index: number, length: number): number {
	return length === 1 ? 500 : (index / (length - 1)) * 1000;
}

function chartY(value: number, max: number): number {
	return 100 - (value / max) * 100;
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
	const [activeIndex, setActiveIndex] = useState<number | null>(null);

	const { linePath, bandPath } = useMemo(() => {
		const line = months
			.map((point, index) => {
				const command = index === 0 ? "M" : "L";

				return `${command}${chartX(index, months.length).toFixed(2)},${chartY(
					point.predicted,
					max,
				).toFixed(2)}`;
			})
			.join(" ");
		const upper = months.map((point, index) =>
			`${index === 0 ? "M" : "L"}${chartX(index, months.length).toFixed(2)},${chartY(
				point.upper,
				max,
			).toFixed(2)}`,
		);
		const lower = months
			.map((point, index) => {
				const reverseIndex = months.length - 1 - index;

				return `L${chartX(reverseIndex, months.length).toFixed(2)},${chartY(
					months[reverseIndex].lower,
					max,
				).toFixed(2)}`;
			})
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

	const activePoint = activeIndex === null ? null : months[activeIndex];
	const tooltipLeft =
		activeIndex === null ? 0 : Math.min(90, Math.max(10, chartX(activeIndex, months.length) / 10));
	const tooltipTop =
		activePoint === null
			? 0
			: Math.min(90, Math.max(12, chartY(activePoint.predicted, max)));

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

			<div className={styles.chart}>
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
								role="group"
								aria-label="Prophet monthly revenue forecast with 80% interval"
							>
								<path
									className={styles.forecastBand}
									d={bandPath}
									aria-hidden="true"
								/>
								<path
									className={styles.forecastLine}
									d={linePath}
									vectorEffect="non-scaling-stroke"
									aria-hidden="true"
								/>
								{months.map((point, index) => (
									<circle
										key={point.date}
										data-testid="forecast-point"
										className={`${styles.forecastPoint} ${
											activeIndex === index ? styles.forecastPointActive : ""
										}`}
										cx={chartX(index, months.length)}
										cy={chartY(point.predicted, max)}
										r={activeIndex === index ? 4 : 2.5}
										tabIndex={0}
										role="img"
										aria-label={`${monthYearLabel(point.date)}: ${formatVndPrice(
											point.predicted,
										)}`}
										onMouseEnter={() => setActiveIndex(index)}
										onMouseLeave={() => setActiveIndex(null)}
										onFocus={() => setActiveIndex(index)}
										onBlur={() => setActiveIndex(null)}
										onKeyDown={(event) => {
											if (event.key === "Escape") setActiveIndex(null);
										}}
									/>
								))}
							</svg>
						)}
						{activePoint && (
							<div
								className={styles.forecastTooltip}
								data-testid="forecast-tooltip"
								style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}
							>
								<strong>{monthYearLabel(activePoint.date)}</strong>
								<span>{formatVndPrice(activePoint.predicted)}</span>
								<span>
									80%: {formatVndPrice(activePoint.lower)} –{" "}
									{formatVndPrice(activePoint.upper)}
								</span>
							</div>
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

			<table className={styles.forecastTable} aria-label="Monthly revenue forecast">
				<thead>
					<tr>
						<th scope="col">Month</th>
						<th scope="col">Predicted revenue</th>
					</tr>
				</thead>
				<tbody>
					{months.map((point) => (
						<tr key={point.date}>
							<th scope="row">{monthYearLabel(point.date)}</th>
							<td>{formatVndPrice(point.predicted)}</td>
						</tr>
					))}
				</tbody>
			</table>

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
