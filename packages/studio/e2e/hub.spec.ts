import { test, expect } from '@playwright/test';

test.describe('Hub E2E Tests', () => {
  test('should load the hub and display connections', async ({ page }) => {
    await page.goto('/');
    // Open modal
    await page.click('button:has-text("Add Connection")');
    await expect(page.locator('text=Add Broker Connection')).toBeVisible();
  });

  test('should open add connection modal and add connection', async ({ page }) => {
    await page.goto('/');
    
    // Open modal
    await page.click('button:has-text("Add Connection")');
    await expect(page.locator('text=Add Broker Connection')).toBeVisible();
    
    // Fill form
    await page.fill('input[placeholder="e.g. Prod Kafka Cluster"]', 'E2E Local Memory');
    await page.fill('input[placeholder="e.g. pkc-12345.us-east-1.aws.confluent.cloud:9092"]', 'memory://local');
    
    // Save
    await page.click('button:has-text("Save Connection")');
    
    // Verify it appeared in the list
    await expect(page.locator('h3:has-text("E2E Local Memory")')).toBeVisible();
  });

  test('should navigate to workbench when creating a project', async ({ page }) => {
    await page.goto('/');
    
    // Click Create Project
    await page.click('button:has-text("Create Workflow")');
    
    // Should show workbench UI instead of URL change
    await expect(page.locator('text=Add Downstream Stage')).toBeVisible();
  });
});
