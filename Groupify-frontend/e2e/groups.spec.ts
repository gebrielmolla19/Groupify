import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5001';
const BASE_URL = 'http://127.0.0.1:3000';

test.describe('Groups', () => {
  test.beforeEach(async ({ page }) => {
    const testLoginUrl = `${BACKEND_URL}/api/v1/auth/test-login`;
    await page.goto(testLoginUrl, { waitUntil: 'commit', timeout: 8000 });
    await page.waitForURL((url) => url.origin === new URL(BASE_URL).origin, { timeout: 8000 }).catch(() => {});
    if (page.url().includes('auth/callback')) {
      await page.waitForURL((url) => url.pathname === '/', { timeout: 10000 }).catch(() => {});
    }
    await page.waitForTimeout(1500);
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});
    const onLogin = page.getByRole('button', { name: /login with spotify/i });
    if (await onLogin.isVisible().catch(() => false)) {
      throw new Error('Test login did not complete. Start backend with E2E_TEST_LOGIN=true.');
    }
  });

  test('dashboard shows groups or empty state', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator('[data-sidebar="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });
});
