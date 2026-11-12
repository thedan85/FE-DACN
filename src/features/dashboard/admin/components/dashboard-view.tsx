"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Segmented, Skeleton } from "antd";

import { ErrorState } from "@/components/feedback/error-state";
import { useAuthStore } from "@/stores/auth-store";
import { formatVndPrice, STORE_TIME_ZONE } from "@/features/products/storefront/model/product-format";
import type { OrderPage } from "@/features/orders/types";

import {
	DASHBOARD_RANGES,
	getDashboardSummary,
	listRecentOrders,
	parseDashboardRange,
	type DashboardRange,
} from "../api/dashboard.api";
import type { DashboardSummary } from "../types";
import { LowStockAlerts } from "./low-stock-alerts";
import { OrderStatusDonut } from "./order-status-donut";
import { RecentOrders } from "./recent-orders";
import { RevenueChart } from "./revenue-chart";
import styles from "./dashboard-view.module.css";

type SummaryState =
	| { status: "loading" }
	| { status: "error"; message: string; requestKey: string }
	| { status: "ready"; summary: DashboardSummary; requestKey: string };

type OrdersState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "ready"; orders: OrderPage };

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

function storeGreeting(): string {
	const hour = Number(
		new Intl.DateTimeFormat("en-GB", {
			hour: "2-digit",
			hour12: false,
			timeZone: STORE_TIME_ZONE,
		}).format(new Date()),
	);

	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";

	return "Good evening";
}

function storeDateLabel(): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: STORE_TIME_ZONE,
	}).format(new Date());
}

/**
 * Store dashboard. The selected range lives in the URL (`?days=7|30|90`) so a
 * filtered view survives reloads and the back button; the API and the chart
 * granularity both follow it. Results carry a request key, matching the
 * catalog listing's pattern, so a slow response from an old range cannot
 * overwrite the current one.
 */
export function DashboardView() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const user = useAuthStore((state) => state.user);

	const days = parseDashboardRange(searchParams.get("days"));
	const [summaryState, setSummaryState] = useState<SummaryState>({
		status: "loading",
	});
	const [ordersState, setOrdersState] = useState<OrdersState>({
		status: "loading",
	});
	const [reloadKey, setReloadKey] = useState(0);
	const [ordersReloadKey, setOrdersReloadKey] = useState(0);

	const requestKey = `${days}:${reloadKey}`;
	const isFetching =
		summaryState.status === "loading" || summaryState.requestKey !== requestKey;

	useEffect(() => {
		let active = true;

		getDashboardSummary(days)
			.then((summary) => {
				if (!active) return;
				setSummaryState({ status: "ready", summary, requestKey });
			})
			.catch((error: unknown) => {
				if (!active) return;
				setSummaryState({
					status: "error",
					message: errorMessage(error, "The dashboard could not be loaded."),
					requestKey,
				});
			});

		return () => {
			active = false;
		};
	}, [days, requestKey]);

	useEffect(() => {
		let active = true;

		listRecentOrders()
			.then((orders) => {
				if (!active) return;
				setOrdersState({ status: "ready", orders });
			})
			.catch((error: unknown) => {
				if (!active) return;
				setOrdersState({
					status: "error",
					message: errorMessage(error, "Recent orders could not be loaded."),
				});
			});

		return () => {
			active = false;
		};
	}, [ordersReloadKey]);

	function changeRange(value: DashboardRange) {
		const params = new URLSearchParams(searchParams.toString());
		params.set("days", String(value));
		router.replace(`${pathname}?${params.toString()}`);
	}

	return (
		<section className={styles.dashboard}>
			<header className={styles.overviewHeader}>
				<div className={styles.welcome}>
					<h1 className={styles.title} suppressHydrationWarning>
						{storeGreeting()}, {user?.name ?? "there"}
					</h1>
					<p className={styles.subtitle} suppressHydrationWarning>
						Here&apos;s your store overview today.
					</p>
				</div>

				<div className={styles.headerActions}>
					<span className={styles.dateChip} suppressHydrationWarning>
						<Image
							src="/images/admin/dashboard/calendar-days.svg"
							alt=""
							width={15}
							height={15}
							unoptimized
						/>
						Today, {storeDateLabel()}
					</span>

					<Segmented<DashboardRange>
						aria-label="Revenue period"
						options={DASHBOARD_RANGES.map((range) => ({
							label: `${range} days`,
							value: range,
						}))}
						value={days}
						onChange={changeRange}
					/>
				</div>
			</header>

			{summaryState.status === "error" && !isFetching ? (
				<ErrorState
					title="We couldn't load your dashboard"
					description={`Nothing was changed. Check your connection and try again.\n${summaryState.message}`}
					onRetry={() => setReloadKey((key) => key + 1)}
				/>
			) : isFetching || summaryState.status !== "ready" ? (
				<DashboardSkeleton />
			) : (
				<>
					<div className={styles.kpiGrid}>
						<KpiCard
							label="Revenue"
							icon="dollar-sign"
							value={formatVndPrice(summaryState.summary.revenue.value)}
							change={summaryState.summary.revenue.changePct}
							detail={`vs. previous ${days} days`}
						/>
						<KpiCard
							label="Orders"
							icon="shopping-bag"
							value={String(summaryState.summary.orders.value)}
							change={summaryState.summary.orders.changePct}
							detail={`vs. previous ${days} days`}
						/>
						<KpiCard
							label="Products"
							icon="fish"
							value={String(summaryState.summary.activeProducts)}
							detail="Active in catalog"
						/>
						<KpiCard
							label="Low Stock Items"
							icon="triangle-alert"
							value={String(summaryState.summary.lowStock.count)}
							tone="warning"
							detail={`At or below ${summaryState.summary.lowStock.threshold} units`}
						/>
					</div>

					<div className={styles.analyticsGrid}>
						<RevenueChart
							points={summaryState.summary.revenueSeries}
							granularity={summaryState.summary.granularity}
							days={days}
							revenue={summaryState.summary.revenue.value}
							changePct={summaryState.summary.revenue.changePct}
						/>
						<OrderStatusDonut
							statuses={summaryState.summary.orderStatus}
							completionRate={summaryState.summary.completionRate}
						/>
					</div>

					<RecentOrdersSection
						state={ordersState}
						onRetry={() => setOrdersReloadKey((key) => key + 1)}
					/>

					<LowStockAlerts
						products={summaryState.summary.lowStockProducts}
						lowStock={summaryState.summary.lowStock}
					/>

					<p className={styles.syncNote}>
						All systems operational · Synced{" "}
						{new Intl.DateTimeFormat("en-GB", {
							hour: "2-digit",
							minute: "2-digit",
							timeZone: STORE_TIME_ZONE,
						}).format(new Date(summaryState.summary.generatedAt))}{" "}
						ICT
					</p>
				</>
			)}
		</section>
	);
}

type RecentOrdersSectionProps = {
	state: OrdersState;
	onRetry: () => void;
};

function RecentOrdersSection({ state, onRetry }: RecentOrdersSectionProps) {
	if (state.status === "ready") {
		return <RecentOrders orders={state.orders} />;
	}

	return (
		<section
			className={`${styles.panel} ${styles.ordersPanel}`}
			aria-labelledby="recent-orders-title"
		>
			<div className={styles.panelHeader}>
				<div className={styles.panelTitleBlock}>
					<h2 id="recent-orders-title" className={styles.panelTitle}>
						Recent orders
					</h2>
					<p className={styles.panelSubtitle}>Newest orders from the store</p>
				</div>
			</div>
			{state.status === "loading" ? (
				<Skeleton active paragraph={{ rows: 3 }} />
			) : (
				<ErrorState
					title="Recent orders could not be loaded"
					description={`${state.message}\nThe rest of the dashboard is unaffected.`}
					onRetry={onRetry}
				/>
			)}
		</section>
	);
}

type KpiCardProps = {
	label: string;
	icon: string;
	value: string;
	change?: number | null;
	detail: string;
	tone?: "warning";
};

function KpiCard({ label, icon, value, change, detail, tone }: KpiCardProps) {
	const changeClass =
		change === undefined || change === null
			? styles.kpiChangeMuted
			: change < 0
				? styles.kpiChangeDown
				: styles.kpiChangeUp;

	return (
		<article className={styles.kpiCard}>
			<div className={styles.kpiHeader}>
				<h2 className={styles.kpiLabel}>{label}</h2>
				<Image
					src={`/images/admin/dashboard/${icon}.svg`}
					alt=""
					width={17}
					height={17}
					unoptimized
				/>
			</div>
			<p className={styles.kpiValue}>{value}</p>
			<p className={styles.kpiMeta}>
				{change !== undefined && (
					<span className={changeClass}>
						{change === null
							? "No prior data"
							: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
					</span>
				)}
				<span className={tone === "warning" ? styles.kpiWarning : undefined}>
					{detail}
				</span>
			</p>
		</article>
	);
}

export function DashboardSkeleton() {
	return (
		<div aria-busy="true" aria-label="Loading dashboard">
			<div className={styles.kpiGrid}>
				{Array.from({ length: 4 }, (_, index) => (
					<div key={index} className={styles.kpiCard}>
						<Skeleton active title={false} paragraph={{ rows: 2 }} />
					</div>
				))}
			</div>
			<div className={styles.analyticsGrid}>
				<div className={styles.panel}>
					<Skeleton active paragraph={{ rows: 6 }} />
				</div>
				<div className={styles.panel}>
					<Skeleton active paragraph={{ rows: 6 }} />
				</div>
			</div>
			<div className={styles.panel}>
				<Skeleton active paragraph={{ rows: 3 }} />
			</div>
		</div>
	);
}
