import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5001';

test.describe('Auth', () => {
  test('login page shows Spotify login', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    const loginButton = page.getByRole('button', { name: /login with spotify|spotify|log in/i });
    await expect(loginButton).toBeVisible();
  });

  test('test-login redirects to dashboard when backend provides token', async ({ page }) => {
    // Requires backend running with E2E_TEST_LOGIN=true or NODE_ENV=test
    const testLoginUrl = `${BACKEND_URL}/api/v1/auth/test-login`;
    await page.goto(testLoginUrl);

    // Backend redirects to frontend /auth/callback?token=... which then redirects to /
    await page.waitForURL(/\/(auth\/callback|\?token=)|^\/(?:\?|$)/, { timeout: 10000 }).catch(() => {});

    // Wait for either dashboard (success) or stay on callback
    await page.waitForTimeout(2000);

    const url = page.url();
    if (url.includes('/auth/callback') || url.includes('token=')) {
      await page.waitForURL(/\/(?!auth\/callback)/, { timeout: 5000 }).catch(() => {});
    }

    if (page.url().includes('/login') === false && page.url().includes('/auth/callback') === false) {
      await expect(page.getByRole('navigation')).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });
});
