"use client";

import type { ReactNode } from "react";
import { Empty, Typography } from "antd";

type EmptyStateProps = {
	title?: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	className?: string;
};

export function EmptyState({
	title,
	description = "There is nothing to display yet.",
	action,
	className,
}: EmptyStateProps) {
	return (
		<div className={className} role="status">
			{title != null && (
				<Typography.Title level={4} style={{ textAlign: "center" }}>
					{title}
				</Typography.Title>
			)}

			<Empty
				image={Empty.PRESENTED_IMAGE_SIMPLE}
				description={description}
			>
				{action}
			</Empty>
		</div>
	);
}
