"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Drawer } from "antd";
import styles from "./site-header.module.css";
import { SearchOutlined, ShoppingCartOutlined, MenuOutlined } from "@ant-design/icons";
import { useMobile } from "@/hooks/use-mobile";

const navigation = [
	{ label: "Shop", href: "/products" },
	{ label: "Fish", href: "/products?category=fish" },
	{ label: "Plants", href: "/products?category=aquatic-plants" },
	{ label: "Equipment", href: "/products?category=equipments" },
	{ label: "Consumables", href: "/products?category=consumables" },
];

export function SiteHeader() {
	const pathname = usePathname();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	function closeMobileMenu() {
		setMobileMenuOpen(false);
	}

	return (
		<>
			<header className={styles.header}>
				<div className={`${styles.container} page-container`}>
					<div className={styles.left}>
						<Link
							href="/"
							className={styles.brand}
							aria-label="Aquarium Store home"
						>
							Aquarium Store
						</Link>

						<nav className={styles.desktopNav} aria-label="Main navigation">
							{navigation.map((item) => {
								const isActive =
									item.href === "/products"
										? pathname === "/products"
										: item.href.startsWith("/products?") &&
										pathname === "/products";

								return (
									<Link
										key={item.label}
										href={item.href}
										className={`${styles.navLink} ${isActive ? styles.activeLink : ""
											}`}
										aria-current={isActive ? "page" : undefined}
									>
										{item.label}
									</Link>
								);
							})}
						</nav>
					</div>

					<div className={styles.actions}>
						<Link
							href="/search"
							className={styles.searchLink}
							aria-label="Search products"
						>
							<SearchOutlined />
						</Link>

						<Link
							href="/cart"
							className={styles.cartLink}
							aria-label="Shopping cart"
						>
							<ShoppingCartOutlined />
						</Link>

						<div className={styles.authLinks}>
							<Link href="/login" className={styles.loginLink}>
								Log In
							</Link>

							<Button
								type="primary"
								className={styles.signupButton}
								href="/register"
							>
								Sign Up
							</Button>
						</div>

						{useMobile() && (
							<Button
								type="text"
								className={`${styles.iconButton} ${styles.menuButton}`}
								aria-label="Open navigation menu"
								aria-expanded={mobileMenuOpen}
								onClick={() => setMobileMenuOpen(true)}
								icon={<MenuOutlined />}
							/>
						)}
					</div>
				</div>
			</header>

			<Drawer
				title={
					<Link href="/" className={styles.drawerBrand} onClick={closeMobileMenu}>
						Aquarium Store
					</Link>
				}
				placement="right"
				open={mobileMenuOpen}
				onClose={closeMobileMenu}
				size={320}
			>
				<nav className={styles.mobileNav} aria-label="Mobile navigation">
					{navigation.map((item) => (
						<Link
							key={item.label}
							href={item.href}
							onClick={closeMobileMenu}
							className={`${styles.mobileNavLink} ${pathname === "/products" && item.label === "Shop"
								? styles.activeLink
								: ""
								}`}
						>
							{item.label}
						</Link>
					))}

					<Link
						href="/cart"
						className={styles.mobileNavLink}
						onClick={closeMobileMenu}
					>
						Shopping Cart
					</Link>

					<Link
						href="/login"
						className={styles.mobileNavLink}
						onClick={closeMobileMenu}
					>
						Log In
					</Link>

					<Link
						href="/register"
						className={styles.mobileNavLink}
						onClick={closeMobileMenu}
					>
						Sign Up
					</Link>
				</nav>
			</Drawer>
		</>
	);
}
