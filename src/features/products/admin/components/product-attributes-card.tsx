"use client";

import { useCallback, useState } from "react";
import { App, Card, Flex, Typography } from "antd";

import type { ProductAttributeValue } from "@/features/products/types";

import {
	addProductAttribute,
	removeProductAttribute,
} from "../api/attributes.api";
import { apiErrorMessage } from "../model/api-error";
import { CATALOG_PERMISSIONS } from "../model/permissions";
import { useAttributeCatalog } from "../use-attribute-catalog";
import { useCatalogPermissions } from "../use-catalog-permissions";
import { AttributeLinkList } from "./attribute-link-list";
import { AttributePicker } from "./attribute-picker";
import styles from "./product-attributes-card.module.css";

const { Text } = Typography;

type ProductAttributesCardProps = {
	productId: string;
	/** The links the product currently has, from the detail aggregate. */
	links: ProductAttributeValue[];
	/** Called with the server's link list after a change, so the page can update. */
	onLinksChanged: (links: ProductAttributeValue[]) => void;
};

/**
 * The product's attributes, replacing the design's fixed "Care information"
 * card: twelve generic attributes rather than five hardcoded fields, because
 * the backend models them generically and the storefront's care guide renders
 * whatever the product links to.
 *
 * Adds and removes are **immediate** — each link is its own resource, so there
 * is nothing to stage and no save bar involved. That is also why a failure
 * surfaces as a toast while the list stays as it was: the server rejected the
 * change, so the screen should not show it.
 */
export function ProductAttributesCard({
	productId,
	links,
	onLinksChanged,
}: ProductAttributesCardProps) {
	const { message } = App.useApp();
	const { can } = useCatalogPermissions();

	// The twelve attributes are cached across the page, so the variant editor's
	// dialog reuses this fetch instead of asking again (useAttributeCatalog).
	const catalog = useAttributeCatalog();
	const [removingId, setRemovingId] = useState<string | null>(null);

	const mayCreate = can(CATALOG_PERMISSIONS.attributeCreate);
	const mayDelete = can(CATALOG_PERMISSIONS.attributeDelete);

	const handleAdd = useCallback(
		async (attributeId: string, attributeValueId: string): Promise<boolean> => {
			try {
				const created = await addProductAttribute({
					productId,
					attributeId,
					attributeValueId,
				});

				onLinksChanged([...links, created]);
				return true;
			} catch (caught) {
				// A 409 here means the server already has a value for this attribute,
				// which the picker normally prevents — so say what the server said
				// rather than guessing at a friendlier wording.
				message.error(
					apiErrorMessage(
						caught,
						"Could not add that attribute. Please try again.",
					),
				);
				// Reported to the user, so no rethrow: the picker's Add is
				// fire-and-forget and a rejection would surface as an unhandled one.
				// `false` is what tells the picker to keep the selection for a retry.
				return false;
			}
		},
		[productId, links, onLinksChanged, message],
	);

	const handleRemove = useCallback(
		async (link: ProductAttributeValue) => {
			setRemovingId(link.productValueId);

			try {
				await removeProductAttribute(link.productValueId);
				onLinksChanged(
					links.filter((item) => item.productValueId !== link.productValueId),
				);
			} catch (caught) {
				message.error(
					apiErrorMessage(
						caught,
						"Could not remove that attribute. Please try again.",
					),
				);
			} finally {
				setRemovingId(null);
			}
		},
		[links, onLinksChanged, message],
	);

	if (!mayCreate) {
		// Ticket 06: hidden entirely without `attribute:create`. Nothing in the
		// card can be done without it — adding is the card's whole purpose — so an
		// inert panel would be noise rather than information.
		return null;
	}

	return (
		<Card
			title="Attributes"
			extra={
				<Text type="secondary" className={styles.help}>
					Shown on the product page under &quot;Care guide&quot;.
				</Text>
			}
		>
			{catalog.status === "failed" ? (
				<Text type="danger" role="alert">
					Could not load the attribute list. Other fields can still be edited.
				</Text>
			) : (
				<AttributePicker
					links={links}
					attributes={catalog.status === "ready" ? catalog.attributes : []}
					disabled={catalog.status !== "ready" || removingId !== null}
					onAdd={handleAdd}
				/>
			)}

			<Flex vertical className={styles.list}>
				<AttributeLinkList
					links={links}
					mayDelete={mayDelete}
					removingId={removingId}
					rowKey={(link) => link.productValueId}
					onRemove={handleRemove}
					emptyDescription="No attributes yet"
				/>
			</Flex>
		</Card>
	);
}

