"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/feedback/error-state";

import styles from "./products.module.css";

export default function ProductsError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Replace with the project's error-reporting service when configured.
		console.error("Products page error:", error);
	}, [error]);

	return (
		<section className={`page-container ${styles.root}`}>
			<ErrorState
				title="Could not load products"
				description="We could not reach the catalog. Please try again."
				onRetry={reset}
			/>
		</section>
	);
}
