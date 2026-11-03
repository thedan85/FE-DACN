
/**
 * The query string shared by every product-list request, in one place.
 *
 * The storefront listing and the admin listing call the same endpoint with the
 * same parameter names, so the serialisation lives here rather than twice.
 * The two callers keep their own *types* — they differ in what they can send
 * (the admin requires a `status` and narrows `sort` to the enum; the storefront
 * receives both as already-validated strings) — but the wire format is one.
 *
 * Parameter names are the backend's, not camelCase: `category_id`, `min_price`,
 * `max_price`. Passing the wrong spelling silently drops the filter, because
 * Spring ignores unknown query params rather than rejecting them.
 */
export interface ProductListQuery {
	/** Case-insensitive substring of the product **name** (not SKU). */
	keyword?: string | undefined;
	/** Category id; the backend expands it to the whole descendant subtree. */
	categoryId?: string | undefined;
	/** Inclusive lower bound on the lowest active variant price. */
	minPrice?: number | undefined;
	/** Inclusive upper bound on the lowest active variant price. */
	maxPrice?: number | undefined;
	/** One `ProductStatus` value — never a set, and never optional on the wire. */
	status: string;
	/** One `ProductSort` value: `NEWEST | PRICE_ASC | PRICE_DESC`. */
	sort: string;
	/** 0-based page index. */
	page: number;
	size: number;
}

/**
 * Builds the query string (without the leading `?`).
 *
 * `status` and `sort` are always sent: omitting `status` makes the backend
 * answer with Active products only, which would quietly hide drafts, and
 * omitting `sort` would silently fall back to the server default.
 */
export function buildProductListQuery(query: ProductListQuery): string {
	const search = new URLSearchParams();

	if (query.keyword) {
		search.set("keyword", query.keyword);
	}

	if (query.categoryId) {
		search.set("category_id", query.categoryId);
	}

	if (query.minPrice != null) {
		search.set("min_price", String(query.minPrice));
	}

	if (query.maxPrice != null) {
		search.set("max_price", String(query.maxPrice));
	}

	search.set("status", query.status);
	search.set("sort", query.sort);
	search.set("page", String(query.page));
	search.set("size", String(query.size));

	return search.toString();
}
