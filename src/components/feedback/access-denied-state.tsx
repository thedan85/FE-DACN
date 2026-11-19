"use client";

import type { ReactNode } from "react";
import { Result } from "antd";

type AccessDeniedStateProps = {
	title?: ReactNode;
	description?: ReactNode;
	extra?: ReactNode;
	className?: string;
};

/**
 * The shared 403/no-permission surface for admin views.
 *
 * Direct links to a gated route land here rather than redirecting, so the
 * visitor sees why the page is unavailable and can ask an administrator for
 * the permission instead of bouncing back to the portal.
 */
export function AccessDeniedState({
	title = "You do not have permission to view this page",
	description = "Ask an administrator to grant the required permission to your role.",
	extra,
	className,
}: AccessDeniedStateProps) {
	return (
		<div className={className}>
			<Result
				status="403"
				title={title}
				subTitle={description}
				extra={extra}
			/>
		</div>
	);
}
