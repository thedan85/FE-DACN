import { Col, Row } from "antd";

import type { Product } from "../../types";
import { ProductCard } from "./product-card";

type ProductGridProps = {
	products: Product[];
};

/**
 * Responsive product grid on antd `Row`/`Col` (3 → 2 → 1 columns): the grid
 * guarantees equal column widths, and stretched `Col`s + `height: 100%`
 * cards give equal card heights regardless of thumbnail or name length.
 */
export function ProductGrid({ products }: ProductGridProps) {
	return (
		<Row gutter={[24, 24]}>
			{products.map((product) => (
				<Col key={product.productId} xs={24} sm={12} md={8}>
					<ProductCard
						product={product}
						inStock={
							product.stock == null ? null : product.stock > 0
						}
					/>
				</Col>
			))}
		</Row>
	);
}
