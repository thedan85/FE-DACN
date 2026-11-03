import type { ProductStatus } from "@/types";

import { formatPriceRange } from "../../storefront/model/product-format";
import { totalStock } from "../../storefront/model/product-stock";
import type { Product, ProductDetail } from "../../types";

/**
 * One row of the Products & Variants listing.
 *
 * The projection exists because the list response and the detail aggregate
 * carry different amounts of the same product, and the table needs both:
 * `ProductResponse` has price, stock and status but **no variant count and no
 * SKU** — those only exist on `VariantDetailResponse`, reachable through the
 * detail aggregate. So a row renders without them, and gains them when its
 * expansion is loaded.
 */
export interface ProductRow {
	productId: string;
	slug: string;
	name: string;
	thumbnail: string | null;
	categoryName: string | null;
	/** The default variant's SKU (the backend sorts it first). `null` until loaded. */
	firstVariantSku: string | null;
	/** How many variants exist. `null` until that product's detail is fetched. */
	variantCount: number | null;
	/** Formatted VND range, `null` when the product has no priced variant. */
	priceRange: string | null;
	/** Total across variants, coerced from the nullable DTO field. */
	stock: number;
	status: ProductStatus;
}

/**
 * Builds a row from whatever is known about the product.
 *
 * Passing `detail` fills the two fields the list response cannot supply. Both
 * stay `null` without it — deliberately, because rendering `0 variants` for a
 * product whose variants simply have not loaded would be a false statement,
 * and it is indistinguishable from a genuinely variant-less product.
 */
export function buildProductRow(
	product: Product,
	detail?: ProductDetail,
): ProductRow {
	// Absent detail means "not loaded yet", which is different from "loaded and
	// empty" — both fields below stay null in the former case only.
	const variants = detail?.variants;

	return {
		productId: product.productId,
		slug: product.slug,
		name: product.name,
		thumbnail: product.thumbnail,
		categoryName: product.categoryName,
		// `variants[0]` is the default variant: `ProductService.getDetail` sorts
		// the `{slug}-default` form first so the storefront's picker shows it.
		firstVariantSku: variants?.[0]?.sku ?? null,
		variantCount: variants?.length ?? null,
		// There is no product-level price on the backend; min/max are derived from
		// the variants. A priceless product is null, never 0.
		priceRange: formatPriceRange(product.minPrice, product.maxPrice),
		stock: totalStock(product.stock),
		status: product.status,
	};
}
