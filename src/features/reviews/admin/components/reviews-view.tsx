"use client";

import { StarFilled, StarOutlined } from "@ant-design/icons";
import {
	Alert,
	App,
	Button,
	Card,
	Descriptions,
	Drawer,
	Input,
	Modal,
	Pagination,
	Select,
	Table,
	Tag,
	Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AccessDeniedState } from "@/components/feedback/access-denied-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { AdminCatalogTheme } from "@/features/products/admin/components/admin-catalog-theme";
import {
	ADMIN_SESSION_REFRESHED_MESSAGE,
	handleAdminAuthFailure,
	recoveredAdminSession,
} from "@/features/auth/admin/model/admin-auth-failure";
import { apiErrorMessage } from "@/features/products/admin/model/api-error";
import {
	STORE_TIME_ZONE,
	formatDate,
} from "@/features/products/storefront/model/product-format";
import type { PageData } from "@/features/products/types";
import { useAuthStore } from "@/stores/auth-store";

import { deleteAdminReview, listAdminReviews } from "../api/admin-reviews.api";
import { REVIEW_PERMISSIONS } from "../model/review-permissions";
import type { AdminReview } from "../schema/admin-reviews.schema";
import styles from "./reviews-view.module.css";

const { Title, Text } = Typography;

const PAGE_SIZE = 20;
const MAX_PAGE = 10_000;

interface ReviewsQuery {
	/** Exact rating 1-5, or undefined for any. */
	rating: number | undefined;
	/** 1-based, the way the URL carries it. */
	page: number;
}

function parseQuery(
	searchParams: { get(name: string): string | null },
): ReviewsQuery {
	const ratingParam = Number(searchParams.get("rating") ?? "");
	const rating = Number.isInteger(ratingParam) &&
		ratingParam >= 1 && ratingParam <= 5
		? ratingParam
		: undefined;
	const parsed = Number(searchParams.get("page") ?? "1");
	const page = Number.isInteger(parsed)
		? Math.min(Math.max(parsed, 1), MAX_PAGE)
		: 1;
	return { rating, page };
}

function toSearchParams(query: ReviewsQuery): Record<string, string> {
	const params: Record<string, string> = {};
	if (query.rating !== undefined) {
		params.rating = String(query.rating);
	}
	if (query.page > 1) {
		params.page = String(query.page);
	}
	return params;
}

type DirectoryState =
	| { status: "loading" }
	| { status: "forbidden" }
	| { status: "error"; message: string; requestKey: string }
	| { status: "ready"; page: PageData<AdminReview>; requestKey: string };

function RatingStars({ rating }: { rating: number }) {
	return (
		<span
			className={styles.stars}
			role="img"
			aria-label={`${rating} out of 5 stars`}
		>
			{Array.from({ length: 5 }, (_, index) =>
				index < rating ? (
					<StarFilled key={index} />
				) : (
					<StarOutlined key={index} />
				),
			)}
		</span>
	);
}

export function ReviewsView() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { message } = App.useApp();
	const permissions = useAuthStore((state) => state.user?.permissions);
	const mayRead = permissions?.includes(REVIEW_PERMISSIONS.read) === true;
	const mayDelete = permissions?.includes(REVIEW_PERMISSIONS.delete) === true;

	const [keywordDraft, setKeywordDraft] = useState("");
	const [keyword, setKeyword] = useState("");
	const [state, setState] = useState<DirectoryState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);
	const [selected, setSelected] = useState<AdminReview | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<AdminReview | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const query = useMemo(() => parseQuery(searchParams), [searchParams]);
	const requestKey = JSON.stringify([query.rating, query.page, keyword, reloadKey]);
	const isFetching =
		state.status === "loading" ||
		((state.status === "ready" || state.status === "error") &&
			state.requestKey !== requestKey);

	useEffect(() => {
		if (!mayRead) {
			return;
		}
		const controller = new AbortController();
		let active = true;

		listAdminReviews(
			{
				page: query.page - 1,
				size: PAGE_SIZE,
				keyword: keyword || undefined,
				rating: query.rating,
			},
			controller.signal,
		)
			.then((pageData) => {
				if (active) {
					setState({ status: "ready", page: pageData, requestKey });
				}
			})
			.catch(async (caught: unknown) => {
				if (!active || controller.signal.aborted) {
					return;
				}
				setState({ status: "loading" });
				const outcome = await handleAdminAuthFailure(caught, router);
				if (!active) {
					return;
				}
				const failureMessage = apiErrorMessage(
					caught,
					"Could not load reviews. Check your connection and try again.",
				);
				const recovered = recoveredAdminSession(outcome);
				if (outcome === "unhandled" || recovered) {
					setState({
						status: "error",
						requestKey,
						message: recovered
							? `${ADMIN_SESSION_REFRESHED_MESSAGE} ${failureMessage}`
							: failureMessage,
					});
					return;
				}
				setState({ status: "forbidden" });
			});

		return () => {
			active = false;
			controller.abort();
		};
	}, [mayRead, query.rating, query.page, keyword, requestKey, router]);

	const updateQuery = useCallback(
		(next: Partial<ReviewsQuery>) => {
			const merged: ReviewsQuery = { ...query, ...next };
			const search = new URLSearchParams(toSearchParams(merged)).toString();
			router.replace(search ? `${pathname}?${search}` : pathname);
		},
		[query, router, pathname],
	);

	const commitKeyword = useCallback(
		(value: string) => {
			const trimmed = value.trim();
			setKeywordDraft(trimmed);
			setKeyword(trimmed);
			if (query.page !== 1) {
				updateQuery({ page: 1 });
			}
		},
		[query.page, updateQuery],
	);

	const clearFilters = useCallback(() => {
		setKeyword("");
		setKeywordDraft("");
		router.replace(pathname);
	}, [router, pathname]);

	const confirmDelete = useCallback(async () => {
		if (deleteTarget === null || !mayDelete || deleting) {
			return;
		}
		setDeleting(true);
		setDeleteError(null);
		try {
			await deleteAdminReview(deleteTarget.reviewId);
			message.success("Review deleted.");
			setDeleteTarget(null);
			setSelected(null);
			setReloadKey((key) => key + 1);
		} catch (caught: unknown) {
			await handleAdminAuthFailure(caught, router);
			setDeleteError(
				apiErrorMessage(caught, "Could not delete the review. Try again."),
			);
		} finally {
			setDeleting(false);
		}
	}, [deleteTarget, deleting, mayDelete, message, router]);

	const columns = useMemo<TableColumnsType<AdminReview>>(
		() => [
			{
				title: "Reviewer",
				key: "reviewer",
				render: (_, row) => (
					<div className={styles.reviewerCell}>
						<span className={styles.reviewerName}>{row.customerName}</span>
						{row.verifiedPurchase && (
							<Tag className={styles.verified}>Verified</Tag>
						)}
					</div>
				),
			},
			{
				title: "Rating",
				key: "rating",
				width: 130,
				render: (_, row) => <RatingStars rating={row.rating} />,
			},
			{
				title: "Product / variant",
				key: "product",
				render: (_, row) => (
					<div className={styles.productCell}>
						<span className={styles.productName}>{row.productName}</span>
						<span className={styles.productSku}>{row.variantSku}</span>
					</div>
				),
			},
			{
				title: "Created",
				key: "created",
				width: 160,
				render: (_, row) =>
					formatDate(row.createdAt, STORE_TIME_ZONE) ?? "—",
			},
			{
				title: "Actions",
				key: "actions",
				width: 130,
				render: (_, row) => (
					<Button type="link" size="small" onClick={() => setSelected(row)}>
						Show details
					</Button>
				),
			},
		],
		[],
	);

	const denied = <AccessDeniedState />;
	const pageData = state.status === "ready" ? state.page : null;
	const hasFilters = keyword !== "" || query.rating !== undefined;
	const ratingOptions = [
		{ value: 0, label: "Any rating", title: "Any rating" },
		...[1, 2, 3, 4, 5].map((value) => ({
			value,
			label: `${value} stars`,
			title: `${value} stars`,
		})),
	];

	return (
		<AdminCatalogTheme>
			<section className={styles.page}>
				<header className={styles.header}>
					<div>
						<Title level={1} className={styles.title}>
							Reviews
						</Title>
						<Text type="secondary">
							Browse customer reviews and remove inappropriate ones.
						</Text>
					</div>
				</header>

				<Card styles={{ body: { padding: 0 } }}>
					<div className={styles.toolbar}>
						<Input.Search
							className={styles.search}
							aria-label="Search reviews"
							placeholder="Search by comment, reviewer, or product"
							value={keywordDraft}
							allowClear
							onChange={(event) => {
								setKeywordDraft(event.target.value);
								if (event.target.value === "") {
									commitKeyword("");
								}
							}}
							onSearch={commitKeyword}
						/>
						<Select
							className={styles.select}
							aria-label="Filter by rating"
							value={query.rating ?? 0}
							options={ratingOptions}
							onChange={(value: number) =>
								updateQuery({
									rating: value >= 1 && value <= 5 ? value : undefined,
									page: 1,
								})
							}
						/>
						{hasFilters && (
							<Button onClick={clearFilters}>Clear filters</Button>
						)}
					</div>

					{!mayRead || state.status === "forbidden" ? (
						denied
					) : state.status === "error" && !isFetching ? (
						<ErrorState
							title="We couldn't load reviews"
							description={state.message}
							retryLabel="Try again"
							onRetry={() => setReloadKey((key) => key + 1)}
						/>
					) : isFetching ? (
						<LoadingState rows={6} label="Loading reviews" />
					) : pageData === null || pageData.content.length === 0 ? (
						<EmptyState
							title={
								hasFilters
									? "No reviews match these filters."
									: "No reviews yet."
							}
							action={
								hasFilters ? (
									<Button onClick={clearFilters}>Clear filters</Button>
								) : undefined
							}
						/>
					) : (
						<Table<AdminReview>
							rowKey="reviewId"
							dataSource={pageData.content}
							columns={columns}
							pagination={false}
							loading={isFetching}
						/>
					)}

					{!isFetching && pageData !== null && pageData.totalElements > 0 && (
						<footer className={styles.pagination}>
							<Pagination
								size="small"
								current={query.page}
								total={pageData.totalElements}
								pageSize={PAGE_SIZE}
								showSizeChanger={false}
								onChange={(next) => updateQuery({ page: next })}
							/>
						</footer>
					)}
				</Card>

				<Drawer
					open={selected !== null}
					onClose={() => setSelected(null)}
					title="Review details"
					size={480}
					destroyOnHidden
					footer={
						mayDelete && selected !== null ? (
							<div className={styles.drawerFooter}>
								<Button
									danger
									onClick={() => {
										setDeleteError(null);
										setDeleteTarget(selected);
									}}
								>
									Delete
								</Button>
							</div>
						) : null
					}
				>
					{selected !== null && (
						<Descriptions
							size="small"
							column={1}
							items={[
								{ key: "reviewer", label: "Reviewer", children: selected.customerName },
								{
									key: "rating",
									label: "Rating",
									children: <RatingStars rating={selected.rating} />,
								},
								{
									key: "verified",
									label: "Verified purchase",
									children: selected.verifiedPurchase ? "Verified" : "Not verified",
								},
								{ key: "product", label: "Product", children: selected.productName },
								{ key: "sku", label: "SKU", children: selected.variantSku },
								{
									key: "created",
									label: "Created",
									children:
										formatDate(selected.createdAt, STORE_TIME_ZONE) ?? "—",
								},
								{
									key: "updated",
									label: "Updated",
									children:
										formatDate(selected.updatedAt, STORE_TIME_ZONE) ?? "—",
								},
								{
									key: "comment",
									label: "Comment",
									children: (
										<Text className={styles.comment}>{selected.comment}</Text>
									),
								},
							]}
						/>
					)}
				</Drawer>

				<Modal
					open={deleteTarget !== null}
					title={
						deleteTarget !== null
							? `Delete review by ${deleteTarget.customerName}?`
							: "Delete review?"
					}
					okText="Delete review"
					okButtonProps={{ danger: true }}
					confirmLoading={deleting}
					closable={!deleting}
					mask={{ closable: !deleting }}
					keyboard={!deleting}
					destroyOnHidden
					transitionName=""
					onOk={confirmDelete}
					onCancel={() => {
						setDeleteTarget(null);
						setDeleteError(null);
					}}
				>
					<Text>
						Deleting this review of {deleteTarget?.productName} is permanent.
					</Text>
					{deleteError !== null && (
						<Alert
							className={styles.deleteError}
							type="error"
							showIcon
							title={deleteError}
						/>
					)}
				</Modal>
			</section>
		</AdminCatalogTheme>
	);
}
