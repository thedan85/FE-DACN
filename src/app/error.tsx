
"use client";

import { useEffect } from "react";
import { Button, Result } from "antd";

export default function ErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Replace with the project's error-reporting service when configured.
		console.error("Route segment error:", error);
	}, [error]);

	return (
		<main>
			<Result
				status="error"
				title="Something went wrong"
				subTitle="An unexpected error occurred. Please try again."
				extra={
					<Button type="primary" onClick={() => reset()}>
						Try again
					</Button>
				}
			/>
		</main>
	);
}