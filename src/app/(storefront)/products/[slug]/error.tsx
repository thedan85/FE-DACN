"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ErrorState } from "@/components/feedback/error-state";

import styles from "./product-detail.module.css";

export default function ProductDetailError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useReplaceWithLogging(error);

	return (
		<section className={`page-container ${styles.root}`}>
			<ErrorState
				title="Could not load this product"
				description="We could not reach the catalog. Please try again."
				onRetry={reset}
				action={
					<Link className={styles.notFoundLink} href="/products">
						Back to products
					</Link>
				}
			/>
		</section>
	);
}

/** Dev-side diagnostics only; never rendered to the user. */
function useReplaceWithLogging(error: Error) {
	useEffect(() => {
		// Replace with the project's error-reporting service when configured.
		console.error("Product detail page error:", error);
	}, [error]);
}
