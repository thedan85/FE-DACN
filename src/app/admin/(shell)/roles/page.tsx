import type { Metadata } from "next";
import { RolesListing } from "@/features/roles/admin/components/roles-listing";

export const metadata: Metadata = { title: "Roles & permissions" };
export default function AdminRolesPage() { return <RolesListing />; }
