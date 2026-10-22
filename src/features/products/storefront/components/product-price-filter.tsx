"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, InputNumber } from "antd";
import { ClearOutlined, FilterOutlined } from "@ant-design/icons";

import { toSearchPath, type ProductListQuery } from "../model/product-search-params";
import styles from "./product-price-filter.module.css";

type ProductPriceFilterProps = {
	query: ProductListQuery;
};

/**
 * Price-range filter (D11): antd `InputNumber` min/max (VND) committed via
 * an explicit Apply button — no navigation per keystroke. Values live in
 * the URL (`?min_price=&max_price=`) like every other filter; an inverted
 * range is normalized by the URL parser (swap) before it reaches the API.
 *
 * No formatter/parser pair: rc-input-number's custom parser must return the
 * value type (number) and cannot express the empty input, which would break
 * clearing a bound — the field shows the plain integer instead.
 */
export function ProductPriceFilter({ query }: ProductPriceFilterProps) {
	const router = useRouter();
	const [minValue, setMinValue] = useState<number | null>(
		query.minPrice ?? null,
	);
	const [maxValue, setMaxValue] = useState<number | null>(
		query.maxPrice ?? null,
	);
	const [lastUrlRange, setLastUrlRange] = useState({
		min: query.minPrice,
		max: query.maxPrice,
	});

	// Sync inputs when the URL range changes from outside (Clear button,
	// back/forward, empty-state links).
	if (
		lastUrlRange.min !== query.minPrice ||
		lastUrlRange.max !== query.maxPrice
	) {
		setLastUrlRange({ min: query.minPrice, max: query.maxPrice });
		setMinValue(query.minPrice ?? null);
		setMaxValue(query.maxPrice ?? null);
	}

	const commit = (
		min: number | null | undefined,
		max: number | null | undefined,
	) => {
		void router.replace(
			toSearchPath({
				...query,
				minPrice: min ?? undefined,
				maxPrice: max ?? undefined,
				page: 1,
			}),
			{ scroll: false },
		);
	};

	const apply = () => {
		const min = minValue ?? undefined;
		const max = maxValue ?? undefined;

		// The URL parser also swaps an inverted range; normalize here too so
		// the input fields immediately show the corrected order.
		if (min != null && max != null && min > max) {
			setMinValue(max);
			setMaxValue(min);
			commit(max, min);
			return;
		}

		commit(min, max);
	};

	const clear = () => {
		setMinValue(null);
		setMaxValue(null);
		commit(undefined, undefined);
	};

	const hasActiveRange = query.minPrice != null || query.maxPrice != null;

	return (
		<div className={styles.price}>
			<h2 className={styles.title}>Price</h2>

			<div className={styles.inputs}>
				<InputNumber
					className={styles.input}
					min={0}
					step={1000}
					precision={0}
					placeholder="Min"
					aria-label="Minimum price"
					suffix="₫"
					value={minValue}
					onChange={setMinValue}
				/>
				<span className={styles.dash} aria-hidden="true">
					–
				</span>
				<InputNumber
					className={styles.input}
					min={0}
					step={1000}
					precision={0}
					placeholder="Max"
					aria-label="Maximum price"
					suffix="₫"
					value={maxValue}
					onChange={setMaxValue}
				/>
			</div>

			<div className={styles.actions}>
				<Button type="primary" icon={<FilterOutlined />} onClick={apply}>
					Apply
				</Button>

				{hasActiveRange && (
					<Button icon={<ClearOutlined />} onClick={clear}>
						Clear
					</Button>
				)}
			</div>
		</div>
	);
}
