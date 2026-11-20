import type { Metadata } from "next";

import { MediaLibraryView } from "@/features/products/admin/components/media-library-view";

export const metadata: Metadata = {
	title: "Media",
};

export default function AdminMediaPage() {
	return <MediaLibraryView />;
}
