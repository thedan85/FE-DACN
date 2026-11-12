"use client";

import { Button, Empty, Flex, Listy, Typography } from "antd";
import { DeleteOutlined } from "@ant-design/icons";

import type { AttributeLink } from "../model/product-attributes";
import { describeAttributeLink } from "../model/product-attributes";

const { Text } = Typography;

type AttributeLinkListProps<Link extends AttributeLink> = {
	links: Link[];
	mayDelete: boolean;
	/** The link currently being removed, so only its own button spins. */
	removingId: string | null;
	/** The link's own removal id: `productValueId` or `variantValueId`. */
	rowKey: (link: Link) => string;
	onRemove: (link: Link) => Promise<void>;
	/** The design's empty copy; varies because a variant is a smaller scope. */
	emptyDescription: string;
};

/**
 * The existing attribute links, each as a removable row.
 *
 * Shared by the product's attributes card and the variant editor's attributes
 * dialog. The two differ only in the id a link is removed by and which endpoint
 * removes it — both owned by the caller — so the links are generic over the
 * structural `AttributeLink` shape and neither screen forks the list.
 */
export function AttributeLinkList<Link extends AttributeLink>({
	links,
	mayDelete,
	removingId,
	rowKey,
	onRemove,
	emptyDescription,
}: AttributeLinkListProps<Link>) {
	if (links.length === 0) {
		return (
			<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />
		);
	}

	return (
		// No `classNames.item` hook: Listy's items are already block-level and
		// full-width, and their padding comes from its own `itemPaddingBlock` /
		// `itemPaddingInline` tokens (set in `AdminCatalogTheme`). A module class
		// here would be 0-1-0 against antd's 0-2-0 chain and could only lose.
		<Listy
			items={links}
			rowKey={rowKey}
			itemRender={(link) => (
				<Flex align="center" justify="space-between" gap={12}>
					<Text>{describeAttributeLink(link)}</Text>
					{mayDelete && (
						<Button
							type="text"
							danger
							size="small"
							icon={<DeleteOutlined />}
							aria-label={`Remove ${link.attributeName}`}
							loading={removingId === rowKey(link)}
							disabled={removingId !== null}
							onClick={() => void onRemove(link)}
						/>
					)}
				</Flex>
			)}
		/>
	);
}
