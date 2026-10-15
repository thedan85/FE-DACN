"use client";

import { Skeleton } from "antd";

type LoadingStateProps = {
	rows?: number;
	title?: boolean;
	label?: string;
	className?: string;
};

export function LoadingState({
	rows = 4,
	title = true,
	label = "Loading content",
	className,
}: LoadingStateProps) {
	return (
		<div
			className={className}
			aria-busy="true"
			aria-label={label}
		>
			<Skeleton
				active
				title={title}
				paragraph={{ rows }}
			/>
		</div>
	);
}
