import { Spin } from "antd";

export default function Loading() {
	return (
		<main
			className="page-container loading-container"
			aria-label="Loading page"
			aria-busy="true"
		>
			<Spin size="large" />
		</main>
	);
}