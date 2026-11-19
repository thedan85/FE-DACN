import type { Metadata } from "next";

import { AttributeDictionaryView } from "@/features/products/admin/components/attribute-dictionary-view";

export const metadata: Metadata = {
	title: "Attributes",
};

export default function AdminAttributesPage() {
	return <AttributeDictionaryView />;
}
