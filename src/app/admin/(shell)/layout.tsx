import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";

type AdminShellLayoutProps = {
	children: ReactNode;
};

/**
 * Wraps every `/admin/*` shell route in the portal shell.
 * The session guard wraps the shell here once it lands (ticket 03);
 * `/admin/login` and the `/admin` redirect intentionally sit outside this group.
 */
export default function AdminShellLayout({ children }: AdminShellLayoutProps) {
	return <AdminLayout>{children}</AdminLayout>;
}
