"use client";

import { useMemo } from "react";

import { formatVndPrice } from "@/features/products/storefront/model/product-format";

import type {
	DashboardRevenuePoint,
	DashboardSummary,
} from "../types";
import styles from "./dashboard-view.module.css";

type RevenueChartProps = {
	points: DashboardRevenuePoint[];
	granularity: DashboardSummary["granularity"];
	days: number;
	revenue: number;
	changePct: number | null;
};

const compactVndFormatter = new Intl.NumberFormat("vi-VN", {
	maximumFractionDigits: 1,
});

/** Short axis label: a nine-character "9 Nov" fits six ticks on a phone. */
const axisDateFormatter = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	timeZone: "Asia/Ho_Chi_Minh",
});

function axisDateLabel(iso: string | undefined): string {
	if (!iso) {
		return "";
	}

	const date = new Date(iso);

	return Number.isNaN(date.getTime()) ? "" : axisDateFormatter.format(date);
}

function compactVnd(value: number): string {
	if (value >= 1_000_000_000) {
		return `${compactVndFormatter.format(value / 1_000_000_000)} tỷ`;
	}
	if (value >= 1_000_000) {
		return `${compactVndFormatter.format(value / 1_000_000)} tr`;
	}
	if (value >= 1_000) {
		return `${compactVndFormatter.format(value / 1_000)}k`;
	}

	return String(Math.round(value));
}

/** Rounds the axis maximum up to 1, 2, 5 or 10 times its magnitude. */
function niceCeiling(value: number): number {
	const magnitude = 10 ** Math.floor(Math.log10(value));
	const normalized = value / magnitude;
	const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

	return step * magnitude;
}

function tickIndexes(length: number, desired: number): number[] {
	if (length <= desired) {
		return Array.from({ length }, (_, index) => index);
	}

	const indexes = new Set<number>();
	for (let index = 0; index < desired; index += 1) {
		indexes.add(Math.round((index * (length - 1)) / (desired - 1)));
	}

	return [...indexes];
}

/**
 * Revenue over the selected window, drawn with the platform instead of a
 * charting dependency. The plot keeps a fixed 1000x100 viewBox and stretches
 * with the card; `vectorEffect` stops the line stroke from stretching with it.
 */
export function RevenueChart({
	points,
	granularity,
	days,
	revenue,
	changePct,
}: RevenueChartProps) {
	const max = useMemo(() => {
		const highest = Math.max(...points.map((point) => point.revenue), 0);

		return highest === 0 ? 1 : niceCeiling(highest);
	}, [points]);

	const linePath = useMemo(() => {
		if (points.length === 0) {
			return "";
		}

		return points
			.map((point, index) => {
				const x = points.length === 1 ? 500 : (index / (points.length - 1)) * 1000;
				const y = 100 - (point.revenue / max) * 100;

				return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
			})
			.join(" ");
	}, [max, points]);

	const areaPath = linePath ? `${linePath} L1000,100 L0,100 Z` : "";
	const visibleTicks = tickIndexes(points.length, points.length <= 7 ? points.length : 6);
	const changeCopy =
		changePct === null
			? "No prior period data"
			: `${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}% vs. previous period`;

	return (
		<section className={styles.panel} aria-labelledby="revenue-chart-title">
			<div className={styles.panelHeader}>
				<div className={styles.panelTitleBlock}>
					<h2 id="revenue-chart-title" className={styles.panelTitle}>
						Revenue
					</h2>
					<p className={styles.panelSubtitle}>
						Last {days} days · {granularity === "WEEK" ? "Weekly" : "Daily"} · VND
					</p>
				</div>
			</div>

			<div className={styles.revenueSummary}>
				<p className={styles.revenueValue}>{formatVndPrice(revenue)}</p>
				<p
					className={`${styles.change} ${
						changePct !== null && changePct < 0 ? styles.changeDown : ""
					}`}
				>
					{changeCopy}
				</p>
			</div>

			<div
				className={styles.chart}
				role="img"
				aria-label={`Revenue over the last ${days} days. Total ${formatVndPrice(revenue)}.`}
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

						{points.length > 0 && (
							<svg
								className={styles.chartSvg}
								viewBox="0 0 1000 100"
								preserveAspectRatio="none"
								aria-hidden="true"
							>
								<path className={styles.chartArea} d={areaPath} />
								<path
									className={styles.chartLine}
									d={linePath}
									vectorEffect="non-scaling-stroke"
								/>
							</svg>
						)}
					</div>
				</div>

				<div className={styles.xAxis} aria-hidden="true">
					{visibleTicks.map((index) => (
						<span key={points[index]?.date ?? index}>
							{axisDateLabel(points[index]?.date)}
						</span>
					))}
				</div>
			</div>
		</section>
	);
}
