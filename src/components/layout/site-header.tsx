"use client";

import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { App, Button, Drawer } from "antd";
import { MenuOutlined, ShoppingOutlined } from "@ant-design/icons";
import { LoginRequiredDialog, LogoutDialog } from "@/components/dialogs/store-dialogs";
import { useAuthStore } from "@/stores/auth-store";
import styles from "./site-header.module.css";

const navigation = [
	{ label: "Shop", href: "/products" },
	{ label: "FAQ", href: "/faq" },
	{ label: "About us", href: "/about" },
];

export function SiteHeader() {
	const pathname = usePathname();
	const router = useRouter();
	const { message } = App.useApp();
	const { user, status, hydrate, signOut } = useAuthStore();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [logoutOpen, setLogoutOpen] = useState(false);
	const [loginRequiredOpen, setLoginRequiredOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);

	const signedIn = status === "authenticated" && user !== null;

	useEffect(() => {
		void hydrate();
	}, [hydrate]);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 8);

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });

		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	function closeMobileMenu() {
		setMobileMenuOpen(false);
	}

	async function handleSignOut() {
		try {
			await signOut();
		} catch {
			message.error("Could not sign out. Please try again.");
		}
	}

	function handleCartClick(event: MouseEvent<HTMLAnchorElement>) {
		if (status !== "anonymous") return;

		event.preventDefault();
		setLoginRequiredOpen(true);
	}

	return (
		<>
			<header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
				<div className={styles.container}>
					<div className={styles.left}>
						<Link
							href="/"
							className={styles.brand}
							aria-label="Aquarium Store home"
						>
							AquariumStore
						</Link>

						<nav className={styles.desktopNav} aria-label="Main navigation">
							{navigation.map((item) => {
								const isActive = pathname === item.href;

								return (
									<Link
										key={item.label}
										href={item.href}
										className={`${styles.navLink} ${isActive ? styles.activeLink : ""}`}
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
							href="/cart"
							className={styles.cartLink}
							aria-label="Shopping cart"
							onClick={handleCartClick}
						>
							<ShoppingOutlined />
						</Link>

						{signedIn && (
							<div className={styles.account}>
								<span className={styles.userName}>{user.name}</span>
								<button
									type="button"
									className={styles.loginLink}
									onClick={() => setLogoutOpen(true)}
								>
									Sign Out
								</button>
							</div>
						)}

						{status === "anonymous" && (
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
						)}

						<Button
							type="text"
							className={`${styles.iconButton} ${styles.menuButton}`}
							aria-label="Open navigation menu"
							aria-expanded={mobileMenuOpen}
							onClick={() => setMobileMenuOpen(true)}
							icon={<MenuOutlined />}
						/>
					</div>
				</div>
			</header>

			<Drawer
				title={
					<Link href="/" className={styles.drawerBrand} onClick={closeMobileMenu}>
						AquariumStore
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
							className={`${styles.mobileNavLink} ${pathname === item.href ? styles.activeLink : ""}`}
						>
							{item.label}
						</Link>
					))}

					<Link
						href="/cart"
						className={styles.mobileNavLink}
						onClick={(event) => {
							closeMobileMenu();
							handleCartClick(event);
						}}
					>
						Shopping Cart
					</Link>

					{signedIn && (
						<>
							<span className={styles.mobileName}>{user.name}</span>
							<button
								type="button"
								className={styles.mobileNavLink}
								onClick={() => {
									closeMobileMenu();
									setLogoutOpen(true);
								}}
							>
								Sign Out
							</button>
						</>
					)}

					{status === "anonymous" && (
						<>
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
						</>
					)}
				</nav>
			</Drawer>

			<LogoutDialog
				open={logoutOpen}
				onClose={() => setLogoutOpen(false)}
				onConfirm={handleSignOut}
			/>

			<LoginRequiredDialog
				open={loginRequiredOpen}
				onClose={() => setLoginRequiredOpen(false)}
				onSignIn={() => {
					setLoginRequiredOpen(false);
					router.push("/login");
				}}
			/>
		</>
	);
}
