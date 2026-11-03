"use client";

import { Button } from "antd";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";

/**
 * The catalog's two non-row states.
 *
 * Both delegate to the shared feedback components so the admin portal's empty
 * and error surfaces match the rest of the app; only the copy is local, because
 * the design's wording is what was approved.
 */

type CatalogEmptyStateProps = {
	onClearFilters: () => void;
	/** True when filters are active, so clearing them can actually help. */
	hasFilters: boolean;
};

/** No rows matched the current filters. */
export function CatalogEmptyState({
	onClearFilters,
	hasFilters,
}: CatalogEmptyStateProps) {
	return (
		<EmptyState
			title="No products found"
			description={
				hasFilters
					? "Try another search or clear your filters."
					: "This catalog is empty. Add a product to get started."
			}
			action={
				hasFilters ? (
					<Button onClick={onClearFilters}>Clear filters</Button>
				) : undefined
			}
		/>
	);
}

type CatalogErrorStateProps = {
	onRetry: () => void;
	/** The server's or transport's own words, shown beneath the fixed copy. */
	message: string;
};

/**
 * The request failed.
 *
 * The design's reassurance line is kept, and the server's own message follows
 * it: a 403 and a dropped connection need different responses from the user,
 * so hiding the reason behind generic copy would leave them unable to tell the
 * two apart (AGENTS.md §11 asks for messages that explain the problem).
 */
export function CatalogErrorState({ onRetry, message }: CatalogErrorStateProps) {
	return (
		<ErrorState
			title="We couldn't load your products"
			description={`Your catalog is safe. Check your connection and try again.\n${message}`}
			retryLabel="Try again"
			onRetry={onRetry}
		/>
	);
}
