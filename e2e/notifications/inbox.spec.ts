import { expect, test } from '@playwright/test';
import { DEGRADED_NOTE } from '../../src/features/notifications/model/readiness-copy';
import {
  assignClientIdentity,
  filterButton,
  getUnreadCountApi,
  loginAdminUI,
  loginCustomerUI,
  readUnreadCount,
  rowForOrder,
  seedOrder,
} from './support';

test.beforeEach(async ({ page }) => {
  await assignClientIdentity(page);
});

test('customer inbox shows the real order notification and degraded fallback copy', async ({
  page,
  request,
}) => {
  const seeded = await seedOrder(request);
  await loginCustomerUI(page);
  await page.goto('/account/notifications');

  await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
  const row = rowForOrder(page, seeded.orderId);
  await expect(row).toBeVisible();
  await expect(row).toContainText(/pending approval/);
  await expect(row).toContainText(/payment is due on delivery/);
  await expect(row.getByText('Unread', { exact: true })).toBeVisible();
  expect(await readUnreadCount(page)).toBeGreaterThan(0);
  expect(await readUnreadCount(page)).toBe(await getUnreadCountApi(request, seeded.customerToken));
  await expect(page.getByText(DEGRADED_NOTE, { exact: true })).toBeVisible();
});

test('company inbox shows the real company notification', async ({ page, request }) => {
  const seeded = await seedOrder(request);
  await loginAdminUI(page);
  await page.goto('/admin/notifications');

  await expect(page.getByRole('heading', { level: 1, name: 'Company notifications' })).toBeVisible();
  const row = rowForOrder(page, seeded.orderId);
  await expect(row).toBeVisible();
  await expect(row).toContainText(/New COD order/);
  await expect(row).toContainText(/awaiting approval/);
  await expect(page.getByText(DEGRADED_NOTE, { exact: true })).toBeVisible();

  expect(await readUnreadCount(page)).toBe(await getUnreadCountApi(request, seeded.adminToken));
  const mark = page.getByRole('button', {
    name: `Mark notification ${seeded.companyNotificationId} as read`,
  });
  await mark.focus();
  await page.keyboard.press('Enter');
  await expect(row.getByText('Read', { exact: true })).toBeVisible();
  await expect
    .poll(async () =>
      (await readUnreadCount(page)) === (await getUnreadCountApi(request, seeded.adminToken)))
    .toBe(true);

  const remove = page.getByRole('button', {
    name: `Delete notification ${seeded.companyNotificationId}`,
  });
  await remove.focus();
  await page.keyboard.press('Space');
  await expect(row).toHaveCount(0);
});

test('bell opens on Enter, shows real preview, and closes on Escape', async ({ page, request }) => {
  const seeded = await seedOrder(request);
  await loginCustomerUI(page);
  await page.goto('/account/notifications');
  await expect(rowForOrder(page, seeded.orderId)).toBeVisible();

  const bell = page.getByRole('button', { name: /^Notifications, \d+ unread$/ });
  await bell.focus();
  await page.keyboard.press('Enter');

  const preview = page.getByRole('dialog', { name: 'Notifications preview' });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(seeded.orderId);
  await expect(preview).toContainText(/pending approval/);
  await expect(preview).toContainText(DEGRADED_NOTE);

  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
  await expect(bell).toBeFocused();
});

test('row actions via keyboard keep the unread count authoritative', async ({ page, request }) => {
  const seeded = await seedOrder(request);
  await loginCustomerUI(page);
  await page.goto('/account/notifications');

  const row = rowForOrder(page, seeded.orderId);
  await expect(row).toBeVisible();
  const before = await readUnreadCount(page);

  const mark = page.getByRole('button', {
    name: `Mark notification ${seeded.customerNotificationId} as read`,
  });
  await mark.focus();
  await page.keyboard.press('Enter');
  await expect(row.getByText('Read', { exact: true })).toBeVisible();
  await expect(mark).toHaveCount(0);
  await expect.poll(() => readUnreadCount(page)).toBeLessThan(before);
  await expect
    .poll(async () =>
      (await readUnreadCount(page)) === (await getUnreadCountApi(request, seeded.customerToken)))
    .toBe(true);

  const remove = page.getByRole('button', {
    name: `Delete notification ${seeded.customerNotificationId}`,
  });
  await remove.focus();
  await page.keyboard.press('Space');
  await expect(row).toHaveCount(0);
  await expect
    .poll(async () =>
      (await readUnreadCount(page)) === (await getUnreadCountApi(request, seeded.customerToken)))
    .toBe(true);
});

test('Unread filter hides a row that was just marked read', async ({ page, request }) => {
  const seeded = await seedOrder(request);
  await loginCustomerUI(page);
  await page.goto('/account/notifications');

  const row = rowForOrder(page, seeded.orderId);
  await expect(row).toBeVisible();
  await page
    .getByRole('button', { name: `Mark notification ${seeded.customerNotificationId} as read` })
    .click();
  await expect(row.getByText('Read', { exact: true })).toBeVisible();

  await filterButton(page, 'Unread').click();
  await expect(row).toHaveCount(0);
  await filterButton(page, 'All').click();
  await expect(row).toBeVisible();
});

test('customer sign out and admin sign in leave only company rows', async ({ page, request }) => {
  const seeded = await seedOrder(request);
  await loginCustomerUI(page);
  await page.goto('/account/notifications');
  await expect(rowForOrder(page, seeded.orderId)).toContainText(/pending approval/);

  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page.getByRole('heading', { name: 'Log out?' })).toBeVisible();
  await page.getByRole('button', { name: 'Log Out', exact: true }).click();
  await expect(page.getByRole('banner').getByRole('link', { name: 'Log In' })).toBeVisible();

  await loginAdminUI(page);
  await page.goto('/admin/notifications');
  const companyRow = rowForOrder(page, seeded.orderId);
  await expect(companyRow).toBeVisible();
  await expect(companyRow).toContainText(/awaiting approval/);

  await page.goto('/account/notifications');
  const storefrontRow = rowForOrder(page, seeded.orderId);
  await expect(storefrontRow).toContainText(/awaiting approval/);
  await expect(storefrontRow).not.toContainText(/pending approval/);
});

test('anonymous guest prompt and admin guard redirect', async ({ page }) => {
  await page.goto('/account/notifications');
  await expect(page.getByText('Sign in to view your notifications.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { level: 2, name: 'Notifications' })).toBeVisible();

  await page.goto('/admin/notifications');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: 'Store admin sign in' })).toBeVisible();
});

test('real REST failure shows error and Retry, then recovers with real data', async ({
  page,
  request,
}) => {
  const seeded = await seedOrder(request);
  await loginCustomerUI(page);
  await page.goto('/account/notifications');

  const row = rowForOrder(page, seeded.orderId);
  await expect(row).toBeVisible();

  const blockNotifications = '**/api/v1/notifications**';
  await page.route(blockNotifications, (route) => route.abort('failed'));
  await filterButton(page, 'Unread').click();

  const error = page.getByRole('alert').filter({ hasText: 'Could not load notifications.' });
  await expect(error).toBeVisible();
  await expect(error.getByRole('button', { name: 'Retry' })).toBeVisible();

  await page.unroute(blockNotifications);
  await error.getByRole('button', { name: 'Retry' }).click();
  await expect(row).toBeVisible();
});
