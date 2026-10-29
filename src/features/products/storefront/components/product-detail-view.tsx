"use client";

import { useState } from "react";
import Link from "next/link";

import type {
	Product,
	ProductAttributeValue,
	ReviewPage,
	VariantDetail,
} from "../../types";
import { summarizeReviews } from "../model/review-summary";
import {
	FishIcon,
	ShieldCheckIcon,
	TruckIcon,
	WaveformBackdrop,
	WavesBackdrop,
} from "./product-detail-icons";
import { ProductCareGuide } from "./product-care-guide";
import { ProductPurchasePanel } from "./product-purchase-panel";
import { ProductReviews } from "./product-reviews";
import { ProductShippingInfo } from "./product-shipping-info";
import { ProductSpecs } from "./product-specs";
import { ProductVariantGallery } from "./product-variant-gallery";
import { ProductVariantSelector } from "./product-variant-selector";
import { RatingStars } from "./rating-stars";

import styles from "./product-detail-view.module.css";

type ProductDetailViewProps = {
	product: Product;
	attributes: ProductAttributeValue[];
	variants: VariantDetail[];
	reviews: ReviewPage;
};

const TABS = [
	{ id: "overview", label: "Overview" },
	{ id: "care", label: "Care Guide" },
	{ id: "shipping", label: "Shipping Info" },
	{ id: "reviews", label: "Reviews" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TRUST_BADGES = [
	{ id: "secure", Icon: ShieldCheckIcon, text: "Secure SSL encrypted checkout" },
	{
		id: "livestock",
		Icon: FishIcon,
		text: "100% healthy livestock arrival guarantee",
	},
	{
		id: "shipping",
		Icon: TruckIcon,
		text: "Carefully insulated and packed temperature controlled shipping",
	},
] as const;

/**
 * The redesigned product detail page ("scarlet-badis-product-page").
 *
 * Owns the two pieces of client state the design needs — the selected
 * variant and the active tab — so the gallery, variant cards, price and
 * purchase panel all read one source of truth. Everything else is rendered
 * from the server-provided aggregate; no refetching.
 */
export function ProductDetailView({
	product,
	attributes,
	variants,
	reviews,
}: ProductDetailViewProps) {
	const [selectedVariantId, setSelectedVariantId] = useState(
		variants[0]?.variantId ?? "",
	);
	const [activeTab, setActiveTab] = useState<TabId>("overview");

	const selectedVariant =
		variants.find((variant) => variant.variantId === selectedVariantId) ??
		variants[0];
	const summary = summarizeReviews(reviews);
	const categoryHref = product.categoryId
		? `/products?category=${encodeURIComponent(product.categoryId)}`
		: null;

	function selectTabFromKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
		if (
			event.key !== "ArrowRight" &&
			event.key !== "ArrowLeft" &&
			event.key !== "Home" &&
			event.key !== "End"
		) {
			return;
		}

		event.preventDefault();

		const tabs = Array.from(
			event.currentTarget.querySelectorAll<HTMLButtonElement>(
				'[role="tab"]',
			),
		);
		const current = tabs.findIndex(
			(tab) => tab.dataset.tabId === activeTab,
		);

		const nextIndex =
			event.key === "Home"
				? 0
				: event.key === "End"
					? tabs.length - 1
					: event.key === "ArrowRight"
						? (current + 1) % tabs.length
						: (current - 1 + tabs.length) % tabs.length;

		setActiveTab(TABS[nextIndex].id);
		tabs[nextIndex]?.focus();
	}

	return (
		<div className={styles.view}>
			<WavesBackdrop className={styles.waves} />
			<WaveformBackdrop className={styles.waveform} />

			<div className={styles.content}>
				<nav aria-label="Breadcrumb">
					<ol className={styles.breadcrumbs}>
						<li>
							<Link href="/">Home</Link>
						</li>
						<li aria-hidden="true">/</li>
						{categoryHref && (
							<>
								<li>
									<Link href={categoryHref}>
										{product.categoryName ?? "Products"}
									</Link>
								</li>
								<li aria-hidden="true">/</li>
							</>
						)}
						<li aria-current="page">{product.name}</li>
					</ol>
				</nav>

				<div className={styles.hero}>
					<div className={styles.galleryColumn}>
						{selectedVariant ? (
							<ProductVariantGallery
								key={selectedVariant.variantId}
								variant={selectedVariant}
								productName={product.name}
							/>
						) : (
							<div className={styles.galleryFallback} />
						)}
					</div>

					<div className={styles.infoColumn}>
						<div className={styles.header}>
							<h1 className={styles.title}>{product.name}</h1>

							<div className={styles.ratingRow}>
								{summary.total > 0 ? (
									<>
										<span className={styles.ratingStars}>
											<RatingStars
												value={summary.average ?? 0}
											/>
										</span>
										<p className={styles.ratingText}>
											{summary.average?.toFixed(1)}
											<button
												type="button"
												className={styles.ratingLink}
												onClick={() =>
													setActiveTab("reviews")
												}
											>
												({summary.total}{" "}
												{summary.total === 1
													? "review"
													: "reviews"}
												)
											</button>
										</p>
									</>
								) : (
									<button
										type="button"
										className={styles.ratingLink}
										onClick={() => setActiveTab("reviews")}
									>
										No reviews yet
									</button>
								)}

								{product.categoryName && (
									<>
										<span
											className={styles.dot}
											aria-hidden="true"
										/>
										<span className={styles.category}>
											{product.categoryName}
										</span>
									</>
								)}
							</div>
						</div>

						<p className={styles.description}>
							{product.description}
						</p>

						<div className={styles.divider} />

						{selectedVariant && variants.length > 0 && (
							<section
								className={styles.variantSection}
								aria-labelledby="variant-heading"
							>
								<h2
									id="variant-heading"
									className={styles.variantHeading}
								>
									Choose your variant
								</h2>
								<ProductVariantSelector
									variants={variants}
									selectedVariantId={
										selectedVariant.variantId
									}
									onSelect={setSelectedVariantId}
								/>
							</section>
						)}

						{selectedVariant && (
							<ProductPurchasePanel
								key={selectedVariant.variantId}
								variant={selectedVariant}
							/>
						)}

						<div className={styles.divider} />

						<ul className={styles.trustBadges}>
							{TRUST_BADGES.map(({ id, Icon, text }) => (
								<li key={id} className={styles.trustBadge}>
									<Icon className={styles.trustIcon} size={16} />
									<span>{text}</span>
								</li>
							))}
						</ul>
					</div>
				</div>

				<div className={styles.tabs}>
					<div
						className={styles.tabBar}
						role="tablist"
						aria-label="Product information"
						onKeyDown={selectTabFromKeyboard}
					>
						{TABS.map((tab) => {
							const isActive = tab.id === activeTab;

							return (
								<button
									key={tab.id}
									type="button"
									role="tab"
									id={`pd-tab-${tab.id}`}
									data-tab-id={tab.id}
									aria-selected={isActive}
									tabIndex={isActive ? 0 : -1}
									className={
										isActive
											? `${styles.tab} ${styles.tabActive}`
											: styles.tab
									}
									onClick={() => setActiveTab(tab.id)}
								>
									{tab.label}
									{tab.id === "reviews" &&
										summary.total > 0 &&
										` (${summary.total})`}
								</button>
							);
						})}
					</div>

					<div
						className={styles.panel}
						role="tabpanel"
						id={`pd-panel-${activeTab}`}
						aria-labelledby={`pd-tab-${activeTab}`}
						tabIndex={0}
					>
						{activeTab === "overview" && (
							<>
								<ProductSpecs attributes={attributes} />
								<ProductCareGuide
									detailDescription={
										product.detailDescription
									}
								/>
								<ProductReviews reviews={reviews} />
							</>
						)}

						{activeTab === "care" && (
							<ProductCareGuide
								detailDescription={product.detailDescription}
							/>
						)}

						{activeTab === "shipping" && <ProductShippingInfo />}

						{activeTab === "reviews" && (
							<ProductReviews reviews={reviews} />
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
