"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useRouter } from "next/navigation";

/**
 * Toolbar replacement for the removed breadcrumbs (decision D18).
 *
 * Goes back through history when there is one, otherwise falls back to the
 * listing — so the control is never a dead end on a direct page load.
 */
export function ProductBackButton() {
	const router = useRouter();

	function goBack() {
		if (window.history.length > 1) {
			router.back();
		} else {
			router.push("/products");
		}
	}

	return (
		<Button icon={<ArrowLeftOutlined />} onClick={goBack}>
			Back to products
		</Button>
	);
}
