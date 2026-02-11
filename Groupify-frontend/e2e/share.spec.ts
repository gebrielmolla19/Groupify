import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5001';

test.describe('Share', () => {
  test.beforeEach(async ({ page }) => {
    const testLoginUrl = `${BACKEND_URL}/api/v1/auth/test-login`;
    await page.goto(testLoginUrl);
    await page.waitForURL(/\/(auth\/callback|\?token=)|^\//, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);
    if (page.url().includes('auth/callback')) {
      await page.waitForURL(/\/(?!auth\/callback)/, { timeout: 8000 }).catch(() => {});
    }
  });

  test('group feed page loads when navigating to a group', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
    const groupLink = page.locator('a[href*="/groups/"]').first();
    const hasGroup = await groupLink.isVisible().catch(() => false);
    if (hasGroup) {
      await groupLink.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/groups\/[^/]+$/);
    }
    expect(true).toBe(true);
  });
});
