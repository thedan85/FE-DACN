import type { Metadata } from "next";
import { RoleCreateForm } from "@/features/roles/admin/components/role-create-form";

export const metadata: Metadata = { title: "Add role" };
export default function AdminRoleCreatePage() { return <RoleCreateForm />; }
