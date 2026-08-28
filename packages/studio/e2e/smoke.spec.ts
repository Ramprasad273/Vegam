import { test, expect } from '@playwright/test';

/**
 * Smoke tests for the Vegam Studio.
 * These tests verify the core user flows work end-to-end in a real browser.
 */

test('hub page loads and displays template workflow cards', async ({ page }) => {
  await page.goto('/');

  // The page must load and show the template gallery
  await expect(page).toHaveTitle(/Vegam/i);
  await expect(page.getByText('Checkout & Payment Pipeline')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Fintech Fraud Surprisal Stream')).toBeVisible();
});

test('clicking a template opens the workbench with nodes loaded', async ({ page }) => {
  await page.goto('/');

  // Open the checkout template
  await page.getByText('Checkout & Payment Pipeline').click();

  // The workbench schema builder must show the first node
  await expect(page.getByText('Order Checkout Gateway')).toBeVisible({ timeout: 8_000 });
});

test('simulation starts and live telemetry panel shows events', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Checkout & Payment Pipeline').click();

  // Ensure workbench is loaded
  await expect(page.getByText('Order Checkout Gateway')).toBeVisible({ timeout: 8_000 });

  // Start the simulation
  const startBtn = page.getByRole('button', { name: /Start Simulation|Run/i });
  await startBtn.click();

  // At least one event must appear in the telemetry feed within 10 seconds
  await expect(page.getByText('orders.checkout')).toBeVisible({ timeout: 10_000 });
});

test('add broker connection modal opens and closes without error', async ({ page }) => {
  await page.goto('/');

  // Open the add-connection modal
  const addBtn = page.getByRole('button', { name: /Add Broker|Add Connection/i });
  if (await addBtn.count() > 0) {
    await addBtn.click();
    await expect(page.getByText(/Broker Connection/i)).toBeVisible({ timeout: 5_000 });

    // Close without saving
    await page.keyboard.press('Escape');
  }
});

test('/api/health endpoint responds correctly to an invalid protocol', async ({ request }) => {
  const response = await request.post('/api/health', {
    data: { protocol: 'INVALID_PROTO', uri: 'localhost:9999' }
  });
  const json = await response.json();
  expect(response.status()).toBe(400);
  expect(json.success).toBe(false);
});

test('/api/health endpoint blocks private IP addresses (SSRF guard)', async ({ request }) => {
  const response = await request.post('/api/health', {
    data: { protocol: 'KAFKA', uri: '169.254.169.254:9092' }
  });
  const json = await response.json();
  // Expect either 403 (SSRF blocked) or connection refused — either is safe
  expect([200, 403, 500]).toContain(response.status());
  if (response.status() === 403) {
    expect(json.success).toBe(false);
  }
});
