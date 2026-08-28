import { test, expect } from '@playwright/test';

test.describe('Workbench Schema & Simulation E2E', () => {
  test('should add nodes to schema tree', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Create Workflow")');
    
    // By default, one stage exists.
    await expect(page.getByText('Stage 1').first()).toBeVisible();
    
    // Add another stage
    await page.click('button:has-text("Add Downstream Stage")');
    await expect(page.getByText('Stage 2').first()).toBeVisible();
  });

  test('should start and stop simulation', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Create Workflow")');
    
    // Click Start Simulation
    await page.click('button:has-text("Start Simulation")');
    
    // Verify Stop Simulation button appears (meaning it's running)
    await expect(page.locator('button:has-text("Stop Simulation")')).toBeVisible();
    
    // Stop simulation
    await page.click('button:has-text("Stop Simulation")');
    await expect(page.locator('button:has-text("Start Simulation")')).toBeVisible();
  });
});
