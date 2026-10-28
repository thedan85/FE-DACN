"use client";

import { Pagination } from "antd";
import { useRouter } from "next/navigation";

import {
	toSearchPath,
	type ProductListQuery,
} from "../model/product-search-params";
import styles from "./product-pagination.module.css";

type ProductPaginationProps = {
	query: ProductListQuery;
	/** 1-based current page (from the URL). */
	page: number;
	pageSize: number;
	total: number;
};

/** URL-driven pagination for the listing; hidden when there is one page. */
export function ProductPagination({
	query,
	page,
	pageSize,
	total,
}: ProductPaginationProps) {
	const router = useRouter();

	if (total === 0) {
		return null;
	}

	return (
		<div className={styles.pagination}>
			<Pagination
				aria-label="Product pages"
				current={page}
				pageSize={pageSize}
				total={total}
				showSizeChanger={false}
				onChange={(nextPage) => {
					void router.replace(
						toSearchPath({ ...query, page: nextPage }),
						{ scroll: false },
					);
				}}
			/>
		</div>
	);
}
