"use client";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "antd";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { useState } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { FeedbackDialog } from "@/components/dialogs/feedback-dialog";

export default function Page() {
	const [isModalOpen, setIsModalOpen] = useState(false);

	return (
		<>
			{/* <div>
				<h1>Hello Next.js!</h1>
				<h2>The Quick Brown Fox Jumps Over The Lazy Dog</h2>
				<h3>Thử nghiệm ngôn ngữ tiếng Việt!</h3>
			</div> */}
			<div>
				<SiteHeader />
				<SectionHeading
					eyebrow="Getting Started"
					title="Build faster with our platform"
					description="Everything you need to ship your next project, all in one place."
				/>
				<Button type="primary" size="large" onClick={() => setIsModalOpen(true)}>
					Test Modal
				</Button>

				{/* <ConfirmDialog
					open={isModalOpen}
					title="Confirm Action"
					description="Are you sure you want to proceed with this action?"
					confirmText="Yes, proceed"
					cancelText="No, cancel"
					confirmLoading={false}
					onConfirm={() => {
						// Handle confirm action here
						setIsModalOpen(false);
					}}
					onCancel={() => setIsModalOpen(false)}
				/> */}

				<EmptyState />
				<ErrorState />
				<LoadingState rows={1} title={false} />
				<FeedbackDialog
					open={isModalOpen}
					variant="info"
					title="Login Required"
					description="Sign in to continue."
					redirectUrl="/login"
					redirectText="Sign In"
					onClose={() => setIsModalOpen(false)}
					showCloseButton={true}
				/>

				<SiteFooter />
			</div>
		</>
	);
}