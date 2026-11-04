"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
	Alert,
	App,
	Button,
	Card,
	Flex,
	Popconfirm,
	Typography,
	Upload,
} from "antd";
import { DeleteOutlined } from "@ant-design/icons";

import type { Product } from "@/features/products/types";

import { uploadProductThumbnail } from "../api/media.api";
import { putProduct } from "../api/products.api";
import { apiErrorMessage } from "../model/api-error";
import {
	IMAGE_ACCEPT_ATTRIBUTE,
	buildThumbnailRemovalRequest,
	validateImageFile,
	withUploadedThumbnail,
} from "../model/media";
import { CATALOG_PERMISSIONS } from "../model/permissions";
import { useCatalogPermissions } from "../use-catalog-permissions";
import { ImageUploadButton } from "./image-upload-button";
import styles from "./product-media-card.module.css";

const { Text, Paragraph } = Typography;

type ProductMediaCardProps = {
	product: Product;
	/** Called with the product carrying its new (or removed) thumbnail. */
	onProductChanged: (product: Product) => void;
};

/**
 * The product's thumbnail — the only image a product has.
 *
 * Uploading *is* replacing: `POST /uploads/products/{id}/thumbnail` attaches the
 * new media as the product's thumbnail inside the same request, so there is no
 * second write and no "save" step. A removal is the opposite — it needs a
 * **`PUT`**, because `PATCH` ignores a null thumbnail (see
 * `buildThumbnailRemovalRequest`).
 *
 * Rejections are shown **inline**, under the control, with whatever the failing
 * side said: the local pre-check's wording when it refuses a file outright, and
 * the backend's own message (`unsupported image type: …`) when the two disagree.
 * A toast alone would scroll away before the user could act on it.
 *
 * The design's second image slot, its drag-to-reorder copy and "Set as primary"
 * are deliberately absent: nothing uploads gallery bytes for a product, so a
 * multi-image area could not be saved. The card states that where the design put
 * the gallery rather than rendering a control that does nothing.
 */
export function ProductMediaCard({
	product,
	onProductChanged,
}: ProductMediaCardProps) {
	const router = useRouter();
	const { message } = App.useApp();
	const { can } = useCatalogPermissions();

	const [uploading, setUploading] = useState(false);
	const [removing, setRemoving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const mayUpload = can(CATALOG_PERMISSIONS.mediaCreate);
	// Removing is a write on the product, so it needs `product:update` as well as
	// being here at all. Gating the two separately matters: an account with
	// `media:create` alone may replace an image but must not clear one.
	const mayRemove = can(CATALOG_PERMISSIONS.productUpdate);

	if (!mayUpload) {
		// Nothing in this card can be done without `media:create` — uploading is its
		// whole purpose — so an inert panel would be noise (ticket 06's rule).
		return null;
	}

	const busy = uploading || removing;

	/**
	 * Runs an upload, reporting a refusal inline and refreshing the route on
	 * success so the server-rendered payload (and therefore the listing, which
	 * reads the same product) stops showing the old image.
	 */
	async function handleFile(file: File) {
		const localError = validateImageFile(file);

		if (localError !== null) {
			setError(localError);
			return;
		}

		setError(null);
		setUploading(true);

		try {
			const uploaded = await uploadProductThumbnail(product.productId, file);
			onProductChanged(withUploadedThumbnail(product, uploaded));
			message.success("Thumbnail updated.");
			router.refresh();
		} catch (caught) {
			// The backend's message is the specific one — a wrong type, an oversize
			// file, or a mismatch between extension and magic bytes each produce a
			// different 400.
			setError(
				apiErrorMessage(
					caught,
					"Could not upload that image. Check your connection and try again.",
				),
			);
		} finally {
			setUploading(false);
		}
	}

	async function handleRemove() {
		setError(null);
		setRemoving(true);

		try {
			// `PUT`, not `PATCH`: only a replace nulls the thumbnail.
			const saved = await putProduct(
				product.productId,
				buildThumbnailRemovalRequest(product),
			);
			onProductChanged(saved);
			message.success("Thumbnail removed.");
			router.refresh();
		} catch (caught) {
			setError(
				apiErrorMessage(
					caught,
					"Could not remove the thumbnail. Please try again.",
				),
			);
		} finally {
			setRemoving(false);
		}
	}

	return (
		<Card
			title="Media"
			extra={
				<Text type="secondary" className={styles.help}>
					One image per product. It is the cover in search and listings.
				</Text>
			}
		>
			<Flex vertical gap={12}>
				{product.thumbnail === null ? (
					/* antd's dragger: the design's empty state is a dropzone, and this is
					   the primitive for one (click to pick *or* drop). It hands the file
					   to the same handler, so both routes share one validation path. */
					<Upload.Dragger
						accept={IMAGE_ACCEPT_ATTRIBUTE}
						showUploadList={false}
						multiple={false}
						disabled={busy}
						beforeUpload={(file) => {
							void handleFile(file);
							// Never let antd post it: `media.api` owns the request (auth
							// headers, response parsing), and LIST_IGNORE leaves no entry in
							// antd's internal file list.
							return Upload.LIST_IGNORE;
						}}
						className={styles.dropzone}
					>
						<Flex vertical align="center" gap={6}>
							<Text strong className={styles.dropTitle}>
								Click to upload or drag and drop
							</Text>
							<Text type="secondary" className={styles.hint}>
								JPG, PNG, WebP or GIF · up to 10 MB
							</Text>
						</Flex>
					</Upload.Dragger>
				) : (
					<>
						<div className={styles.preview}>
							<Image
								className={styles.image}
								src={product.thumbnail}
								alt={`Thumbnail for ${product.name}`}
								fill
								unoptimized
							/>
						</div>

						<Flex align="center" justify="space-between" gap={12} wrap>
							<Text type="secondary" className={styles.hint}>
								JPG, PNG, WebP or GIF · up to 10 MB.
							</Text>
							<Flex gap={8}>
								<ImageUploadButton
									label="Replace"
									loading={uploading}
									disabled={removing}
									onFile={(file) => void handleFile(file)}
									onInvalid={setError}
								/>
								{mayRemove && (
									<Popconfirm
										title="Remove this thumbnail?"
										description="The product keeps its other details; it just has no image until you upload another."
										okText="Remove thumbnail"
										okButtonProps={{ danger: true }}
										cancelText="Cancel"
										onConfirm={() => void handleRemove()}
										disabled={busy}
									>
										<Button
											danger
											icon={<DeleteOutlined />}
											loading={removing}
											disabled={uploading}
										>
											Remove
										</Button>
									</Popconfirm>
								)}
							</Flex>
						</Flex>
					</>
				)}

				{error !== null && (
					<Alert
						type="error"
						showIcon
						title="That image was not accepted"
						description={error}
						// v6 moved the dismiss callback onto `closable`; a bare `onClose`
						// prop is deprecated (`antd lint`).
						closable={{ onClose: () => setError(null) }}
					/>
				)}

				{/* The design's gallery occupies a second slot with drag-to-reorder and
				    "set as primary". None of that has an endpoint: `POST /media` accepts
				    an already-hosted URL and nothing uploads gallery bytes, so this
				    states the limitation instead of rendering dead controls. */}
				<Paragraph type="secondary" className={styles.limit}>
					A product has one image. Additional gallery images are not supported
					by the catalog API.
				</Paragraph>
			</Flex>
		</Card>
	);
}
