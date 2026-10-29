import type { ComponentType } from "react";

import type { ProductAttributeValue } from "../../types";
import {
	BoxIcon,
	DropletIcon,
	EarthLockIcon,
	FishIcon,
	type IconProps,
	RulerIcon,
	ShieldCheckIcon,
	StarIcon,
	ThermometerIcon,
} from "./product-detail-icons";

import styles from "./product-specs.module.css";

type ProductSpecsProps = {
	attributes: ProductAttributeValue[];
};

/** The order used by the reference design; unknown attributes follow. */
const SPEC_ORDER = [
	"minimum-tank-size",
	"temperature",
	"ph",
	"care-level",
	"temperament",
	"size",
	"diet",
	"aquarium-level",
];

const SPEC_ICONS: Record<string, ComponentType<IconProps>> = {
	"minimum-tank-size": BoxIcon,
	temperature: ThermometerIcon,
	ph: DropletIcon,
	"care-level": StarIcon,
	temperament: ShieldCheckIcon,
	size: RulerIcon,
	diet: FishIcon,
	"aquarium-level": EarthLockIcon,
};

function rank(attributeId: string): number {
	const index = SPEC_ORDER.indexOf(attributeId);

	return index === -1 ? SPEC_ORDER.length : index;
}

/** Quick Specifications — the product-level attribute grid (4 × 2). */
export function ProductSpecs({ attributes }: ProductSpecsProps) {
	if (attributes.length === 0) {
		return null;
	}

	const ordered = [...attributes].sort(
		(left, right) => rank(left.attributeId) - rank(right.attributeId),
	);

	return (
		<section className={styles.root} aria-labelledby="specs-heading">
			<h2 id="specs-heading" className={styles.heading}>
				Quick Specifications
			</h2>

			<div className={styles.grid}>
				{ordered.map((attribute) => {
					const Icon = SPEC_ICONS[attribute.attributeId] ?? BoxIcon;

					return (
						<div
							key={attribute.productValueId}
							className={styles.card}
						>
							<span className={styles.iconBadge}>
								<Icon size={20} />
							</span>
							<div className={styles.text}>
								<p className={styles.label}>
									{attribute.attributeName}
								</p>
								<p className={styles.value}>
									{attribute.attributeValue}
								</p>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
