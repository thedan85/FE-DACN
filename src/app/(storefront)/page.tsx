import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SectionHeading } from "@/components/ui/section-heading";

export default function Page() {

	return (
		<>
			<SiteHeader />
			<SectionHeading
				eyebrow="Getting Started"
				title="Build faster with our platform"
				description="Everything you need to ship your next project, all in one place."
			/>
			<SiteFooter />
		</>
	);
}