import { redirect } from "next/navigation";

/** `/admin` is the portal root — it resolves to the dashboard route. */
export default function AdminIndexPage() {
	redirect("/admin/dashboard");
}
