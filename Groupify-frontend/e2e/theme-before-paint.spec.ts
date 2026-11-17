import { test, expect } from '@playwright/test';

// #60: the theme class must be on <html> before React mounts. Blocking the
// app bundle leaves only index.html's inline script to set it, so these
// fail if that script is removed or drifts from the ThemeProvider settings.
async function loadWithoutReact(page: import('@playwright/test').Page, stored: string | null) {
  await page.route('**/src/main.tsx*', (route) => route.abort());
  await page.addInitScript((value) => {
    if (value === null) localStorage.removeItem('groupify-theme');
    else localStorage.setItem('groupify-theme', value);
  }, stored);
  await page.goto('/login');
  return page.evaluate(() => ({
    className: document.documentElement.className,
    colorScheme: document.documentElement.style.colorScheme,
  }));
}

test.describe('theme before first paint', () => {
  test('stored light theme is applied without React', async ({ page }) => {
    expect(await loadWithoutReact(page, 'light')).toEqual({ className: 'light', colorScheme: 'light' });
  });

  test('no stored theme defaults to dark', async ({ page }) => {
    expect(await loadWithoutReact(page, null)).toEqual({ className: 'dark', colorScheme: 'dark' });
  });

  test('"system" follows the device setting', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await loadWithoutReact(page, 'system')).toEqual({ className: 'light', colorScheme: 'light' });
  });
});
