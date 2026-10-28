import { Card, Col, Row, Skeleton } from "antd";

const SKELETON_ITEMS = Array.from({ length: 12 }, (_, index) => index);

type ProductGridSkeletonProps = {
	/** Number of placeholder cards; defaults to one page of products. */
	count?: number;
};

/** Loading placeholder mirroring the real grid (`Row`/`Col` of antd Cards). */
export function ProductGridSkeleton({ count = 12 }: ProductGridSkeletonProps) {
	const items = SKELETON_ITEMS.slice(0, count);

	return (
		<div role="status" aria-label="Loading products">
			<Row gutter={[24, 24]} aria-hidden="true">
				{items.map((item) => (
					<Col key={item} xs={24} sm={12} md={8}>
						<Card>
							<Skeleton
								active
								avatar={{ shape: "square" }}
								title={{ width: "65%" }}
								paragraph={{ rows: 2 }}
							/>
						</Card>
					</Col>
				))}
			</Row>
		</div>
	);
}
