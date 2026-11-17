import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/site-header", () => ({
	SiteHeader: () => <div data-testid="site-header" />,
}));
vi.mock("@/components/layout/site-footer", () => ({
	SiteFooter: () => <div data-testid="site-footer" />,
}));
vi.mock("@/components/layout/admin-portal-guard", () => ({
	AdminPortalGuard: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="admin-guard">{children}</div>
	),
}));
vi.mock("@/components/layout/admin-layout", () => ({
	AdminLayout: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="admin-shell">{children}</div>
	),
}));
vi.mock("@/features/notifications/components/notification-inbox", () => ({
	NotificationInbox: ({ mode }: { mode: "customer" | "company" }) => (
		<div data-testid="notification-inbox" data-mode={mode} />
	),
}));

import StorefrontLayout from "@/app/(storefront)/layout";
import CustomerPage from "@/app/(storefront)/account/notifications/page";
import AdminShellLayout from "@/app/admin/(shell)/layout";
import AdminPage from "@/app/admin/(shell)/notifications/page";

afterEach(() => cleanup());

describe("inbox routes inside the existing shells", () => {
	it("renders the customer inbox inside the storefront header/footer shell", () => {
		render(<StorefrontLayout><CustomerPage /></StorefrontLayout>);
		expect(screen.getByTestId("site-header")).toBeTruthy();
		expect(screen.getByTestId("site-footer")).toBeTruthy();
		const inbox = screen.getByTestId("notification-inbox");
		expect(inbox.getAttribute("data-mode")).toBe("customer");
		expect(inbox.parentElement?.tagName).toBe("MAIN");
	});

	it("renders the company inbox inside the guarded admin shell", () => {
		render(<AdminShellLayout><AdminPage /></AdminShellLayout>);
		const guard = screen.getByTestId("admin-guard");
		const shell = screen.getByTestId("admin-shell");
		expect(guard.contains(shell)).toBe(true);
		expect(shell.querySelector("[data-testid='notification-inbox']")?.getAttribute("data-mode"))
			.toBe("company");
	});
});
