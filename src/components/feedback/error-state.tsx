"use client";

import type { ReactNode } from "react";
import { Button, Result } from "antd";

type ErrorStateProps = {
	title?: ReactNode;
	description?: ReactNode;
	retryLabel?: string;
	onRetry?: () => void;
	action?: ReactNode;
	className?: string;
};

export function ErrorState({
	title = "Something went wrong",
	description = "We could not complete this action. Please try again.",
	retryLabel = "Try again",
	onRetry,
	action,
	className,
}: ErrorStateProps) {
	const actions = (
		<>
			{action}

			{onRetry && (
				<Button type="primary" onClick={onRetry}>
					{retryLabel}
				</Button>
			)}
		</>
	);

	return (
		<div className={className}>
			<Result
				status="error"
				title={title}
				subTitle={description}
				extra={onRetry || action ? actions : undefined}
			/>
		</div>
	);
}
