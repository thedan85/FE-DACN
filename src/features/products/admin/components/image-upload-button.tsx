"use client";

import { Button, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";

import { validateImageFile, IMAGE_ACCEPT_ATTRIBUTE } from "../model/media";

type ImageUploadButtonProps = {
	/** The button's own label: "Upload", "Replace", "Add image". */
	label: string;
	disabled?: boolean;
	/** True while this control's upload is in flight. */
	loading?: boolean;
	/** Called with a file that passed the local pre-check. */
	onFile: (file: File) => void;
	/** Called with the pre-check's reason when the file is refused. */
	onInvalid: (message: string) => void;
};

/**
 * A button that picks an image and hands it to the caller, without uploading it
 * itself.
 *
 * `beforeUpload` returns `Upload.LIST_IGNORE`, so antd never posts the file —
 * the request has to go through `media.api`, which is what attaches the
 * session's auth headers and validates the response. Returning `false` would
 * also stop the upload but still puts the file in antd's internal list; ignoring
 * it keeps the component stateless.
 *
 * The pre-check runs here rather than in each caller so the product's cover and
 * a variant's image refuse exactly the same files, in the same words. The
 * backend still owns the decision: its 400 message is what the caller shows when
 * it disagrees.
 */
export function ImageUploadButton({
	label,
	disabled = false,
	loading = false,
	onFile,
	onInvalid,
}: ImageUploadButtonProps) {
	return (
		<Upload
			// Narrows the picker to the types the backend accepts, derived from the
			// model's list so the two cannot drift. Not a guard on its own — a file
			// can still be dragged in — hence the check below.
			accept={IMAGE_ACCEPT_ATTRIBUTE}
			showUploadList={false}
			disabled={disabled || loading}
			beforeUpload={(file) => {
				const error = validateImageFile(file);

				if (error !== null) {
					onInvalid(error);
					return Upload.LIST_IGNORE;
				}

				onFile(file);
				return Upload.LIST_IGNORE;
			}}
		>
			{/* `disabled` is passed explicitly even though antd would inherit the
			    surrounding `Form disabled` context: an upload is gated on
			    `media:create`, not on `product:update`, so it must stay usable on a
			    form whose fields are disabled. */}
			<Button
				icon={<UploadOutlined />}
				loading={loading}
				disabled={disabled || loading}
			>
				{label}
			</Button>
		</Upload>
	);
}
