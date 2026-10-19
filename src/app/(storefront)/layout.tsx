import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function StorefrontLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<>
			<SiteHeader />
			<main>{children}</main>
			<SiteFooter />
		</>
	);
}
