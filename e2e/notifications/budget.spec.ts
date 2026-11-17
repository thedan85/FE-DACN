import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  assignClientIdentity,
  filterButton,
  loginCustomerUI,
  rowForOrder,
  seedOrder,
} from './support';

type Sample = { action: string; ms: number };

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1))];
}

test.beforeEach(async ({ page }) => {
  await assignClientIdentity(page);
});

/**
 * Task 17 interaction budget. Real browser, real seeded order, real backend.
 * Interval starts at the browser pointerdown event and ends at the first check
 * that the expected visible state is present (small Playwright IPC tail).
 */
test('interaction click-to-visible p95 stays within 200ms', async ({ page, request }) => {
  const seeded = await seedOrder(request);
  await loginCustomerUI(page);
  await page.goto('/account/notifications');
  await expect(rowForOrder(page, seeded.orderId)).toBeVisible();

  await page.evaluate(() => {
    (window as unknown as { __t17Down: number }).__t17Down = 0;
    document.addEventListener('pointerdown', () => {
      (window as unknown as { __t17Down: number }).__t17Down = performance.now();
    }, true);
  });

  const samples: Sample[] = [];
  async function sample(action: string, click: () => Promise<void>, visible: () => Promise<void>) {
    await click();
    await visible();
    const ms = await page.evaluate(() =>
      performance.now() - (window as unknown as { __t17Down: number }).__t17Down);
    samples.push({ action, ms });
  }

  // 18 real filter toggles: each changes the radio state and refetches via REST.
  for (let i = 0; i < 18; i++) {
    const name = i % 2 === 0 ? 'Unread' : 'All';
    await sample(
      'filter',
      () => filterButton(page, name).click(),
      async () => {
        await expect(filterButton(page, name).locator('xpath=..'))
          .toHaveClass(/ant-radio-button-wrapper-checked/);
      },
    );
  }

  const row = rowForOrder(page, seeded.orderId);
  await sample(
    'mark-read',
    () => page.getByRole('button', {
      name: `Mark notification ${seeded.customerNotificationId} as read`,
    }).click(),
    async () => {
      await expect(row.getByText('Read', { exact: true })).toBeVisible();
    },
  );
  await sample(
    'delete',
    () => page.getByRole('button', {
      name: `Delete notification ${seeded.customerNotificationId}`,
    }).click(),
    async () => {
      await expect(row).toHaveCount(0);
    },
  );

  const ms = samples.map((s) => s.ms);
  const p50 = percentile(ms, 0.5);
  const p95 = percentile(ms, 0.95);
  const p99 = percentile(ms, 0.99);
  const mean = ms.reduce((a, b) => a + b, 0) / ms.length;
  const variance = ms.reduce((a, b) => a + (b - mean) ** 2, 0) / ms.length;

  const out = process.env.TASK17_INTERACTION_JSON ?? 'task-17-interaction-samples.json';
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({
    method: 'browser pointerdown -> first visible-state assertion (Playwright IPC tail included)',
    workload: '18 real filter toggles + 1 mark-read + 1 delete on real seeded order',
    samples,
    summary: {
      count: samples.length,
      p50Ms: p50, p95Ms: p95, p99Ms: p99, varianceMs2: variance, targetP95Ms: 200,
    },
  }, null, 2));
  console.log(`TASK17_INTERACTION_BUDGET count=${samples.length} p50=${p50.toFixed(1)}ms ` +
    `p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms variance=${variance.toFixed(1)}ms2`);

  expect(samples).toHaveLength(20);
  expect(p95).toBeLessThanOrEqual(200);
});
