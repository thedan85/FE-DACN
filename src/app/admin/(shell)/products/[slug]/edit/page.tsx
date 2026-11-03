import type { Metadata } from "next";

import { ProductEditScreen } from "@/features/products/admin/components/product-edit-screen";

type EditProductPageProps = {
	params: Promise<{ slug: string }>;
};

export const metadata: Metadata = {
	title: "Edit product",
};

/**
 * The edit route.
 *
 * The product is loaded in the browser, not here: it is a staff read of a row
 * that may be DRAFT or Archived, and the access token lives in memory in the
 * client (`features/auth/session`), so a server render has no credential to
 * send. The portal guard has already confirmed the account before this mounts,
 * so the request that follows is the same one the listing makes.
 */
export default async function AdminEditProductPage({
	params,
}: EditProductPageProps) {
	const { slug } = await params;

	// Next already decodes route params; decoding again would corrupt a slug
	// containing a literal `%` and can throw on a malformed sequence.
	return <ProductEditScreen slug={slug} />;
}
