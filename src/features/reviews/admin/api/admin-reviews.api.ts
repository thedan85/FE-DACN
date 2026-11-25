import { getAuthHeaders } from "@/features/auth/session";
import type { PageData } from "@/features/products/types";
import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import {
	createApiResponseSchema,
	createPageResponseSchema,
} from "@/lib/api/schema";

import { AdminReviewSchema, type AdminReview } from "../schema/admin-reviews.schema";

const adminReviewPageSchema = createApiResponseSchema(
	createPageResponseSchema(AdminReviewSchema),
);

export interface AdminReviewListParams {
	/** 0-based page index. */
	page: number;
	size: number;
	keyword?: string;
	rating?: number;
}

export async function listAdminReviews(
	params: AdminReviewListParams,
	signal?: AbortSignal,
): Promise<PageData<AdminReview>> {
	const search = new URLSearchParams({
		page: String(params.page),
		size: String(params.size),
	});
	const keyword = params.keyword?.trim();
	if (keyword) {
		search.set("keyword", keyword);
	}
	if (params.rating !== undefined) {
		search.set("rating", String(params.rating));
	}

	const payload = await apiFetch<unknown>(`admin/reviews?${search.toString()}`, {
		headers: getAuthHeaders(),
		signal,
	});

	return parseOrThrow(
		adminReviewPageSchema,
		payload,
		"The admin review list response",
	).data;
}

export async function deleteAdminReview(reviewId: string): Promise<void> {
	await apiFetch<unknown>(`admin/reviews/${encodeURIComponent(reviewId)}`, {
		method: "DELETE",
		headers: getAuthHeaders(),
	});
}
