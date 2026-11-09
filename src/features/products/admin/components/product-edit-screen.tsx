"use client";

import { useEffect, useState } from "react";
import { Button, Result, Skeleton } from "antd";

import { ApiError } from "@/lib/api/client";
import type { ProductDetail } from "@/features/products/types";

import { getAdminProductDetailBySlug } from "../api/products.api";
import { AdminCatalogTheme } from "./admin-catalog-theme";
import { CatalogErrorState } from "./catalog-states";
import { ProductEditForm } from "./product-edit-form";

const LISTING_PATH = "/admin/products";

type LoadState =
	| { status: "loading" }
	| { status: "not-found" }
	| { status: "error"; message: string }
	| { status: "ready"; detail: ProductDetail };

type ProductEditScreenProps = {
	slug: string;
};

/**
 * Loads the product, then renders the editor.
 *
 * Three distinguishable outcomes, because they need different words: a slug
 * that does not exist (404 — "not found"), a request that failed (retry), and
 * a successful read. Collapsing 404 into the generic error state would tell a
 * user to "check your connection" about a product that simply is not there.
 */
export function ProductEditScreen({ slug }: ProductEditScreenProps) {
	const [state, setState] = useState<LoadState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);

	useEffect(() => {
		let active = true;

		getAdminProductDetailBySlug(slug)
			.then((detail) => {
				if (active) {
					setState({ status: "ready", detail });
				}
			})
			.catch((caught: unknown) => {
				if (!active) {
					return;
				}

				if (caught instanceof ApiError && caught.status === 404) {
					setState({ status: "not-found" });
					return;
				}

				setState({
					status: "error",
					message:
						caught instanceof ApiError && caught.status > 0
							? caught.message
							: "Could not reach the server. Check your connection and try again.",
				});
			});

		return () => {
			active = false;
		};
	}, [slug, reloadKey]);

	return (
		<AdminCatalogTheme>
			{state.status === "loading" ? (
				<Skeleton active paragraph={{ rows: 8 }} />
			) : state.status === "not-found" ? (
				<Result
					status="404"
					title="Product not found"
					subTitle={`No product matches "${slug}". It may have been deleted, or the link may be wrong.`}
					extra={<Button href={LISTING_PATH}>Back to Products &amp; Variants</Button>}
				/>
			) : state.status === "error" ? (
				<CatalogErrorState
					message={state.message}
					onRetry={() => {
						setState({ status: "loading" });
						setReloadKey((previous) => previous + 1);
					}}
				/>
			) : (
				<ProductEditForm detail={state.detail} />
			)}
		</AdminCatalogTheme>
	);
}
