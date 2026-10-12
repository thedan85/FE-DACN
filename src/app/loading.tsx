
import { Skeleton } from "antd";

export default function Loading() {
	return (
		<main
			className="page-container"
			aria-label="Loading page"
			aria-busy="true"
		>
			<Skeleton active paragraph={{ rows: 4 }} />
		</main>
	);
}