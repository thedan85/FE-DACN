
import Link from "next/link";
import { Button, Result } from "antd";

export default function NotFound() {
	return (
		<main className="page-container">
			<Result
				status="404"
				title="404"
				subTitle="The page you are looking for could not be found."
				extra={
					<Button type="primary">
						<Link href="/">Back to home</Link>
					</Button>
				}
			/>
		</main>
	);
}