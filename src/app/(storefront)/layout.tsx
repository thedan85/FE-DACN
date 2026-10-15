
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import Providers from "../providers";
import { designTokenCssVariables } from "@/lib/design-tokens";
import "../globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
	variable: "--font-plus-jakarta-sans",
	display: "swap",
});

export const metadata: Metadata = {
	title: {
		default: "Aquarium Store",
		template: "%s | Aquarium Store",
	},
	description: "Explore aquarium supplies, fish care products, and accessories.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="vi"
			className={plusJakartaSans.variable}
			style={designTokenCssVariables}
			data-scroll-behavior="smooth"
		>
			<body>
				<AntdRegistry>
					<Providers>{children}</Providers>
				</AntdRegistry>
			</body>
		</html>
	);
}