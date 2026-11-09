import type { Metadata } from "next";
import { ProductCreateForm } from "@/features/products/admin/components/product-create-form";

export const metadata: Metadata = {
	title: "Add product",
};

export default function AdminNewProductPage() {
	return <ProductCreateForm />;
}
