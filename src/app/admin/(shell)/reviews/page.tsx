import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/feedback/loading-state";
import { ReviewsView } from "@/features/reviews/admin/components/reviews-view";

export const metadata: Metadata = {
	title: "Reviews",
};

export default function AdminReviewsPage() {
	return (
		<Suspense fallback={<LoadingState label="Loading reviews" />}>
			<ReviewsView />
		</Suspense>
	);
}
