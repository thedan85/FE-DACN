import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { AdminPortalGuard } from "@/components/layout/admin-portal-guard";

type AdminShellLayoutProps = {
	children: ReactNode;
};

/**
 * Wraps every `/admin/*` shell route in the portal guard, then the shell.
 * `/admin/login` and the `/admin` redirect intentionally sit outside this
 * group, so the guard never wraps the sign-in surface.
 */
export default function AdminShellLayout({ children }: AdminShellLayoutProps) {
	return (
		<AdminPortalGuard>
			<AdminLayout>{children}</AdminLayout>
		</AdminPortalGuard>
	);
}
