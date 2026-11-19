import type { Metadata } from "next";
import { RoleDetailScreen } from "@/features/roles/admin/components/role-detail-screen";
import { decodeRoleRouteParam } from "@/features/roles/admin/model/role-format";

export const metadata: Metadata = { title: "Role detail" };
export default async function AdminRoleDetailPage({ params }: { params: Promise<{ roleId: string }> }) {
	const { roleId } = await params;
	return <RoleDetailScreen roleId={decodeRoleRouteParam(roleId)} />;
}
