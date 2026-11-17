import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API = process.env.NOTIFICATIONS_E2E_API_BASE ?? 'http://localhost:8080/api/v1';

export const CUSTOMER = {
  email: 'swagger.customer@example.com',
  password: 'Swagger123!',
};

export const ADMIN = {
  email: 'swagger.admin@example.com',
  password: 'Swagger123!',
};

type Envelope<T> = { code: number; message: string; data: T };

// Auth login also caps 10 attempts/min per shared source IP; use a distinct trusted IP per test.
let clientIpCounter = 0;

export async function assignClientIdentity(page: Page): Promise<void> {
  clientIpCounter += 1;
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.16.0.${clientIpCounter}` });
}

export type NotificationRow = {
  notificationId: string;
  message: string;
  status: 'UNREAD' | 'READ';
  orderId: string | null;
};

type InboxData = {
  notifications: { content: NotificationRow[] };
  unreadCount: number;
  revision: number;
};

export type SeededOrder = {
  orderId: string;
  customerToken: string;
  adminToken: string;
  customerNotificationId: string;
  companyNotificationId: string;
};

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const response = await request.post(`${API}/auth/login`, {
    data: { email, password },
  });
  expect(response.ok(), `login failed for ${email}`).toBeTruthy();
  const body = (await response.json()) as Envelope<{ accessToken: string }>;
  return body.data.accessToken;
}

// auth/login allows 10 per account per 15 minutes: cache one token per account for 10 minutes per worker.
const TOKEN_TTL_MS = 10 * 60 * 1000;
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function cachedApiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const cached = tokenCache.get(email);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const token = await apiLogin(request, email, password);
  tokenCache.set(email, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

export async function getUnreadCountApi(
  request: APIRequestContext,
  token: string,
): Promise<number> {
  const response = await request.get(`${API}/notifications/unread-count`, {
    headers: auth(token),
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as Envelope<{ unreadCount: number }>;
  return body.data.unreadCount;
}

async function waitForInboxRow(
  request: APIRequestContext,
  token: string,
  orderId: string,
): Promise<NotificationRow> {
  let found: NotificationRow | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(`${API}/notifications?page=0&size=100`, {
        headers: auth(token),
      });
      if (!response.ok()) return false;
      const body = (await response.json()) as Envelope<InboxData>;
      found = body.data.notifications.content.find(
        (item) => item.orderId === orderId || item.message.includes(orderId),
      );
      return found !== undefined;
    }, { message: `in-app notification for ${orderId} to be delivered`, timeout: 30000 })
    .toBe(true);
  if (!found) throw new Error(`notification for ${orderId} was not delivered`);
  return found;
}

/** Seeds one order through the real API; RabbitMQ delivery is configured externally. */
export async function seedOrder(request: APIRequestContext): Promise<SeededOrder> {
  const customerToken = await cachedApiLogin(request, CUSTOMER.email, CUSTOMER.password);
  const adminToken = await cachedApiLogin(request, ADMIN.email, ADMIN.password);

  const add = await request.post(`${API}/cart/items`, {
    headers: auth(customerToken),
    data: { variantId: 'ember-tetra-default', quantity: 1 },
  });
  expect(add.ok(), 'cart add failed').toBeTruthy();

  const checkout = await request.post(`${API}/cart/checkout`, {
    headers: auth(customerToken),
    data: {
      address: '123 Demo St, HCMC',
      recipientName: 'Swagger Customer',
      phone: '0901234567',
      province: 'Ho Chi Minh City',
      ward: 'Cho Quan Ward',
      method: 'COD',
    },
  });
  expect(checkout.ok(), 'checkout failed').toBeTruthy();
  const placed = (await checkout.json()) as Envelope<{ orderId: string }>;
  const orderId = placed.data.orderId;
  expect(orderId).toBeTruthy();

  const customerRow = await waitForInboxRow(request, customerToken, orderId);
  const companyRow = await waitForInboxRow(request, adminToken, orderId);
  return {
    orderId,
    customerToken,
    adminToken,
    customerNotificationId: customerRow.notificationId,
    companyNotificationId: companyRow.notificationId,
  };
}

export async function loginCustomerUI(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(CUSTOMER.email);
  await page.locator('#login-password').fill(CUSTOMER.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function loginAdminUI(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill(ADMIN.email);
  await page.locator('input[name="password"]').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

export async function readUnreadCount(page: Page): Promise<number> {
  const text = await page.getByText(/^\d+ unread$/).first().innerText();
  return Number.parseInt(text, 10);
}

export function rowForOrder(page: Page, orderId: string) {
  return page.getByRole('listitem').filter({ hasText: orderId }).first();
}

/** antd Radio.Button hides its input; click the visible label inside the filter group. */
export function filterButton(page: Page, name: 'All' | 'Unread') {
  return page.getByRole('radiogroup', { name: 'Filter notifications' }).getByText(name, { exact: true });
}
