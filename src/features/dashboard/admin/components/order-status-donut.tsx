"use client";

import { useMemo } from "react";

import { designTokens } from "@/lib/design-tokens";
import type { OrderStatus } from "@/types";

import {
	DASHBOARD_ORDER_STATUS_LABELS,
	DASHBOARD_ORDER_STATUS_ORDER,
} from "../model/order-status";
import type { DashboardSummary } from "../types";
import styles from "./dashboard-view.module.css";

type OrderStatusDonutProps = {
	statuses: DashboardSummary["orderStatus"];
	completionRate: DashboardSummary["completionRate"];
};

const STATUS_ORDER = DASHBOARD_ORDER_STATUS_ORDER;
const STATUS_LABELS = DASHBOARD_ORDER_STATUS_LABELS;

const DONUT_COLORS: Record<OrderStatus, string> = {
	COMPLETED: designTokens.colors.admin.donutCompleted,
	SHIPPING: designTokens.colors.admin.donutShipping,
	CONFIRMED: designTokens.colors.admin.donutConfirmed,
	PENDING: designTokens.colors.admin.donutPending,
	CANCELLED: designTokens.colors.admin.donutCancelled,
};

const RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Order-status split as a stroked SVG ring. The totals include every order in
 * the selected window, matching the KPI, so the centre always agrees with the
 * legend. Cancelled is a segment too: hiding it would make the percentages lie.
 */
export function OrderStatusDonut({
	statuses,
	completionRate,
}: OrderStatusDonutProps) {
	const counts = useMemo(
		() => new Map(statuses.map((entry) => [entry.status, entry.count])),
		[statuses],
	);
	const total = completionRate.total;
	const segments = STATUS_ORDER.map((status) => ({
		status,
		count: counts.get(status) ?? 0,
	})).filter((segment) => segment.count > 0);

	const arcs = segments.map((segment, index) => {
		const length = (segment.count / total) * CIRCUMFERENCE;
		const offset = segments
			.slice(0, index)
			.reduce(
				(sum, previous) => sum + (previous.count / total) * CIRCUMFERENCE,
				0,
			);

		return {
			...segment,
			dashArray: `${length} ${CIRCUMFERENCE - length}`,
			dashOffset: -offset,
		};
	});

	return (
		<section className={styles.panel} aria-labelledby="order-status-title">
			<div className={styles.panelHeader}>
				<h2 id="order-status-title" className={styles.panelTitle}>
					Order status
				</h2>
				<p className={styles.panelSubtitle}>Selected period</p>
			</div>

			<div className={styles.distribution}>
				<div
					className={styles.donutWrap}
					role="img"
					aria-label={segments
						.map((segment) => `${STATUS_LABELS[segment.status]}: ${segment.count}`)
						.join(", ")}
				>
					<svg className={styles.donut} viewBox="0 0 144 144" aria-hidden="true">
						<circle
							className={styles.donutTrack}
							cx="72"
							cy="72"
							r={RADIUS}
							fill="none"
							strokeWidth="16"
						/>
						{arcs.map((arc) => (
							<circle
								key={arc.status}
								cx="72"
								cy="72"
								r={RADIUS}
								fill="none"
								stroke={DONUT_COLORS[arc.status]}
								strokeWidth="16"
								strokeDasharray={arc.dashArray}
								strokeDashoffset={arc.dashOffset}
								transform="rotate(-90 72 72)"
							/>
						))}
					</svg>

					<span className={styles.donutCenter}>
						<strong>{total}</strong>
						<span>orders</span>
					</span>
				</div>

				<ul className={styles.legend}>
					{STATUS_ORDER.map((status) => (
						<li key={status} className={styles.legendRow}>
							<span
								className={styles.legendDot}
								style={{ background: DONUT_COLORS[status] }}
								aria-hidden="true"
							/>
							<span className={styles.legendLabel}>{STATUS_LABELS[status]}</span>
							<span className={styles.legendValue}>{counts.get(status) ?? 0}</span>
						</li>
					))}
				</ul>
			</div>

			<div className={styles.panelFooter}>
				<span>Completion rate</span>
				<strong>{completionRate.pct.toFixed(1)}%</strong>
			</div>
		</section>
	);
}
