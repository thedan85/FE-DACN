import type { Metadata } from "next";
import { NotificationInbox } from "@/features/notifications/components/notification-inbox";

export const metadata: Metadata = {
	title: "Notifications",
	description: "Review your order and account notifications.",
};

export default function NotificationsPage() {
	return <NotificationInbox mode="customer" />;
}
