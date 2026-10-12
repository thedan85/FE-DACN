
"use client";

import { useEffect } from "react";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Replace with the project's error-reporting service when configured.
		console.error("Root application error:", error);
	}, [error]);

	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					padding: "48px 24px",
					fontFamily: "Arial, sans-serif",
					color: "#0F172A",
					background: "#F2F7F5",
					textAlign: "center",
				}}
			>
				<main>
					<h1>Application error</h1>
					<p>
						The application encountered an unexpected error.
						Please try again.
					</p>
					<button
						type="button"
						onClick={() => reset()}
						style={{
							padding: "12px 24px",
							border: 0,
							borderRadius: "9999px",
							color: "#0F172A",
							background: "#1BC5BD",
							cursor: "pointer",
						}}
					>
						Try again
					</button>
				</main>
			</body>
		</html>
	);
}