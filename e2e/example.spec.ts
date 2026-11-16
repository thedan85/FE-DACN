import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API = process.env.TASK18_API_BASE ?? 'http://localhost:8080/api/v1';
const ADMIN_EMAIL = process.env.TASK18_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.TASK18_ADMIN_PASSWORD ?? '';
const PASSWORD = 'Task18Customer!234';

type Product = { productId: string; slug: string; name: string };
type Variant = { variantId: string; stock: number | null; stockRevision: number | null };

async function apiLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email, password } });
  expect(res.ok(), `login failed for ${email}`).toBeTruthy();
  const body = await res.json();
  return body.data.accessToken as string;
}

async function getVariant(request: APIRequestContext, token: string, variantId: string): Promise<Variant> {
  const res = await request.get(`${API}/variants/${encodeURIComponent(variantId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.data as Variant;
}

async function setStock(request: APIRequestContext, token: string, variantId: string, stock: number): Promise<void> {
  const current = await getVariant(request, token, variantId);
  const res = await request.patch(`${API}/variants/${encodeURIComponent(variantId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { stock, expectedStockRevision: current.stockRevision },
  });
  expect(res.ok(), `admin PATCH stock to ${stock} failed`).toBeTruthy();
  const after = await getVariant(request, token, variantId);
  expect(after.stock).toBe(stock);
}

async function pickProduct(request: APIRequestContext): Promise<{ product: Product; variant: Variant }> {
  const res = await request.get(`${API}/products?page=0&size=50`);
  expect(res.ok()).toBeTruthy();
  const page = await res.json();
  expect(page.data.content.length).toBeGreaterThan(0);
  for (const candidate of page.data.content as Array<{ productId: string; slug: string; stock: number | null }>) {
    if (!candidate.slug) continue;
    const detail = await request.get(`${API}/products/${encodeURIComponent(candidate.slug)}`);
    if (!detail.ok()) continue;
    const body = await detail.json();
    const variants = (body.data?.variants ?? []) as Variant[];
    if (variants.length > 0 && (variants[0].stock ?? 0) >= 20) {
      return { product: { productId: candidate.productId, slug: candidate.slug, name: candidate.slug }, variant: variants[0] };
    }
  }
  throw new Error('no seeded product with a well-stocked variant found');
}

async function forceReconcile(page: Page): Promise<void> {
  await page.evaluate(() => {
    const set = (value: string) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    set('hidden');
    set('visible');
  });
}

async function register(request: APIRequestContext, email: string, name: string): Promise<void> {
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: PASSWORD, name, phone: '0901234567' },
  });
  // 409 means the deterministic fixture user already exists; 429 means the
  // local register rate limit was reached by an earlier run of this gate.
  if (!res.ok() && res.status() !== 409 && res.status() !== 429) {
    throw new Error(`register failed: ${res.status()}`);
  }
}

async function loginUI(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function stubShipping(page: Page): Promise<void> {
  await page.route('**/api/v1/shipping/ghn/provinces**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, message: 'ok', data: [{ id: 1, name: 'Test Province' }] }) });
  });
  await page.route('**/api/v1/shipping/ghn/wards**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, message: 'ok', data: [{ id: 11, name: 'Test Ward' }] }) });
  });
}

test.describe.configure({ mode: 'serial' });

let adminToken = '';
let picked: { product: Product; variant: Variant };
const suffix = 'task18gate';

test.beforeAll(async ({ request }) => {
  adminToken = await apiLogin(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  picked = await pickProduct(request);
  await register(request, `t18a-${suffix}@example.invalid`, 'Task18 A');
  await register(request, `t18b-${suffix}@example.invalid`, 'Task18 B');
  await register(request, `t18c-${suffix}@example.invalid`, 'Task18 C');
  await register(request, `t18d-${suffix}@example.invalid`, 'Task18 D');
  await setStock(request, adminToken, picked.variant.variantId, 50);
});

test.afterAll(async ({ request }) => {
  if (picked) await setStock(request, adminToken, picked.variant.variantId, 50);
});

test('case 1: stale stock warns, disables and preserves variant/quantity, then recovers', async ({ page, request }) => {
  const target = `${API}/products/${encodeURIComponent(picked.product.slug)}`;
  await page.goto(`/products/${encodeURIComponent(picked.product.slug)}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(async () => (await request.get(target)).ok()).toBeTruthy();

  // Choose the preselected variant and quantity 4 while stock is 50.
  const qty = page.getByRole('group', { name: 'Quantity' });
  await expect(qty.locator('output')).toHaveText('1');
  // Stock snapshot and auth must resolve before the stepper and button enable.
  await expect(page.getByRole('button', { name: 'ADD TO CART' })).toBeEnabled();
  for (let i = 0; i < 3; i++) await qty.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(qty.locator('output')).toHaveText('4');
  await expect(page.getByRole('button', { name: 'ADD TO CART' })).toBeEnabled();

  // Authoritative REST change, then a REST-only reconcile via refocus.
  await setStock(request, adminToken, picked.variant.variantId, 2);
  await forceReconcile(page);
  const warning = page.getByRole('alert').filter({ hasText: 'Only 2 left in stock' });
  await expect(warning).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'ADD TO CART' })).toBeDisabled();
  await expect(qty.locator('output')).toHaveText('4');
  await expect(page.getByRole('heading', { name: 'Choose your variant' })).toBeVisible();

  // Restore and reconcile again.
  await setStock(request, adminToken, picked.variant.variantId, 50);
  await forceReconcile(page);
  await expect(warning).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'ADD TO CART' })).toBeEnabled();
  await expect(qty.locator('output')).toHaveText('4');
});

test('case 2: checkout details survive a stock drop and submission is gated', async ({ page, request }) => {
  await stubShipping(page);
  await loginUI(page, `t18a-${suffix}@example.invalid`);
  await page.goto(`/products/${encodeURIComponent(picked.product.slug)}`);
  const qty = page.getByRole('group', { name: 'Quantity' });
  await expect(page.getByRole('button', { name: 'ADD TO CART' })).toBeEnabled();
  await qty.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(qty.locator('output')).toHaveText('2');
  await page.getByRole('button', { name: 'ADD TO CART' }).click();
  await expect(page.getByText(/Added .* to your cart/)).toBeVisible();

  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await page.locator('#checkout-name').fill('Task18 Recipient');
  await page.locator('#checkout-phone').fill('0901234567');
  await page.locator('#checkout-address').fill('18 Local Test Street');
  await page.locator('input[name="paymentMethod"][value="COD"]').check();
  await expect(page.getByRole('button', { name: /Place Order/ })).toBeEnabled();

  await setStock(request, adminToken, picked.variant.variantId, 1);
  await forceReconcile(page);
  const shortage = page.getByRole('alert').filter({ hasText: 'Some items are no longer available in the requested quantity' });
  await expect(shortage).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: /Place Order/ })).toBeDisabled();
  await expect(page.locator('#checkout-name')).toHaveValue('Task18 Recipient');
  await expect(page.locator('#checkout-phone')).toHaveValue('0901234567');
  await expect(page.locator('#checkout-address')).toHaveValue('18 Local Test Street');
  await expect(page.locator('input[name="paymentMethod"][value="COD"]')).toBeChecked();

  await setStock(request, adminToken, picked.variant.variantId, 50);
  await forceReconcile(page);
  await expect(shortage).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole('button', { name: /Place Order/ })).toBeEnabled();
  await expect(page.locator('#checkout-name')).toHaveValue('Task18 Recipient');
});

test('case 3: two carts compete for one item; one order and one visible rejection', async ({ browser, request }) => {
  await setStock(request, adminToken, picked.variant.variantId, 1);
  const ctxA = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const ctxB = await browser.newContext({ baseURL: 'http://localhost:3000' });
  try {
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    await stubShipping(a);
    await stubShipping(b);
    await loginUI(a, `t18c-${suffix}@example.invalid`);
    await loginUI(b, `t18d-${suffix}@example.invalid`);
    for (const [page, name] of [[a, 'C'], [b, 'D']] as const) {
      await page.goto(`/products/${encodeURIComponent(picked.product.slug)}`);
      await expect(page.getByRole('button', { name: 'ADD TO CART' })).toBeEnabled();
      await page.getByRole('button', { name: 'ADD TO CART' }).click();
      await expect(page.getByText(/Added .* to your cart/)).toBeVisible();
      await page.goto('/checkout');
      // Wait for profile hydration before editing: it prefills once from /me.
      await expect(page.getByRole('link', { name: 'Open my account' })).toContainText(`Task18 ${name}`);
      await page.locator('#checkout-name').fill(`Task18 ${name}`);
      await page.locator('#checkout-phone').fill('0901234567');
      await page.locator('#checkout-address').fill('18 Race Street');
      await page.locator('#checkout-province').click();
      await page.getByTitle('Test Province').click();
      await page.locator('#checkout-ward').click();
      await page.getByTitle('Test Ward').click();
      await page.locator('input[name="paymentMethod"][value="COD"]').check();
      await expect(page.getByRole('button', { name: /Place Order/ })).toBeEnabled();
    }
    const results = await Promise.allSettled([
      a.getByRole('button', { name: /Place Order/ }).click(),
      b.getByRole('button', { name: /Place Order/ }).click(),
    ]);
    for (const result of results) if (result.status === 'rejected') throw result.reason;

    await expect.poll(async () => {
      const urls = [a.url(), b.url()];
      return urls.filter((url) => url.includes('/account/orders')).length;
    }, { timeout: 15000 }).toBe(1);
    const winner = a.url().includes('/account/orders') ? a : b;
    const loser = winner === a ? b : a;
    await expect(loser).toHaveURL(/\/checkout$/);
    const loserAlerts = await loser.locator('[role="alert"]').allTextContents();
    expect(loserAlerts.some((text) => /Could not place your order|no longer available|not enough|insufficient/i.test(text))).toBeTruthy();
    await expect(loser.locator('#checkout-name')).toHaveValue(/Task18 [CD]/);
    const after = await getVariant(request, adminToken, picked.variant.variantId);
    expect(after.stock).toBe(0);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test('case 4: REST-only recovery on refocus with denied realtime and preserved selection', async ({ page }) => {
  const realtimeCalls: string[] = [];
  const hostedRealtimeCalls: string[] = [];
  await page.route('**/api/v1/realtime/credentials**', (route) => {
    realtimeCalls.push(route.request().url());
    return route.abort();
  });
  await page.route('**/realtime/v1/**', (route) => {
    hostedRealtimeCalls.push(route.request().url());
    return route.abort();
  });
  await setStock(page.request, adminToken, picked.variant.variantId, 7);
  await page.goto(`/products/${encodeURIComponent(picked.product.slug)}`);
  const qty = page.getByRole('group', { name: 'Quantity' });
  await expect(page.getByRole('button', { name: 'ADD TO CART' })).toBeEnabled();
  for (let i = 0; i < 2; i++) await qty.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(qty.locator('output')).toHaveText('3');

  await setStock(page.request, adminToken, picked.variant.variantId, 1);
  await forceReconcile(page);
  const warning = page.getByRole('alert').filter({ hasText: 'Only 1 left in stock' });
  await expect(warning).toBeVisible({ timeout: 15000 });
  await expect(qty.locator('output')).toHaveText('3');
  await expect(page.getByRole('button', { name: /Add to Cart/i }).first()).toBeAttached();
  // Realtime is disabled in this run; any credential attempt was denied locally.
  expect(hostedRealtimeCalls).toEqual([]);
});
