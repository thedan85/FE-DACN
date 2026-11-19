import type { Metadata } from "next";

import { CategoriesView } from "@/features/products/admin/components/categories-view";

export const metadata: Metadata = {
	title: "Categories",
};

export default function AdminCategoriesPage() {
	return <CategoriesView />;
}
