import type { Metadata } from "next";
import { NotificationInbox } from "@/features/notifications/components/notification-inbox";

export const metadata: Metadata = {
	title: "Notifications",
	description: "Review company order and account notifications.",
};

export default function AdminNotificationsPage() {
	return <NotificationInbox mode="company" />;
}
