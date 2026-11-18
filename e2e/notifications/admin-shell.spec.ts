import { expect, test } from "@playwright/test";
import { loginAdminUI } from "./support";

test("admin navigation and notifications stay usable across viewport changes", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await loginAdminUI(page);
	const sidebars = page.getByRole("complementary", { name: "Admin sidebar" });
	const menu = page.getByRole("button", { name: "Open navigation" });
	const bell = page.getByRole("button", { name: /company notifications/i });

	await expect(sidebars).toHaveCount(1);
	await page.getByRole("button", { name: "Collapse sidebar" }).press("Enter");
	await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
	await expect(menu).toBeHidden({ timeout: 2000 });

	await page.setViewportSize({ width: 768, height: 900 });
	await expect(bell).toBeVisible();
	await expect(sidebars).toHaveCount(0);
	await menu.click();
	await expect(sidebars).toHaveCount(1);
	await page.keyboard.press("Escape");
	await expect(sidebars).toHaveCount(0);

	await menu.click();
	await expect(sidebars).toHaveCount(1);
	await page.setViewportSize({ width: 1024, height: 900 });
	await expect(page.getByRole("dialog")).toBeHidden();
	await expect(sidebars).toHaveCount(1);

	await page.setViewportSize({ width: 320, height: 640 });
	const preview = page.getByRole("dialog", { name: "Company notifications preview" });
	await bell.press("Enter");
	await expect(preview).toBeInViewport({ ratio: 0.99 });
	await bell.press("Enter");
	await expect(preview).toBeHidden();
	await bell.press("Space");
	await expect(preview).toBeVisible();
	await page.keyboard.press("Tab");
	await expect(preview).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(preview).toBeHidden();
	await expect(bell).toBeFocused();
});
