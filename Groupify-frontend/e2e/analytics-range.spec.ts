import { test, expect, type Page } from '@playwright/test';
import { openSampleFeed } from './support/sampleFeed';

// #146: Group Dynamics has one period control, in the header, and every
// section asks the backend for that period. The choice survives a reload.
const sections = {
  'Resonance Frequency': ['/activity', 'timeRange'],
  'Hall of Fame': ['/superlatives', 'timeRange'],
  'Listener Reflex': ['/listener-reflex', 'range'],
  'Taste Gravity': ['/taste-gravity', 'timeRange'],
  You: ['/you', 'range'],
} as const;

/** The period each section last asked for. */
function watchRanges(page: Page) {
  const asked: Record<string, string | null> = {};
  page.on('request', (request) => {
    const url = new URL(request.url());
    for (const [name, [path, param]] of Object.entries(sections)) {
      if (url.pathname.endsWith(`/analytics/g1${path}`)) asked[name] = url.searchParams.get(param);
    }
  });
  return asked;
}

const everySectionAsked = (asked: Record<string, string | null>, range: string) =>
  Object.fromEntries(Object.keys(sections).map((name) => [name, asked[name] === range ? range : asked[name] ?? 'nothing']));
const expected = (range: string) => Object.fromEntries(Object.keys(sections).map((name) => [name, range]));

for (const size of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
  test(`one period control drives every section and is remembered · ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await openSampleFeed(page, { theme: 'dark' });
    const asked = watchRanges(page);
    await page.goto('/groups/g1/analytics');
    // The screen loads lazily on first visit.
    await expect(page.getByRole('heading', { name: 'Group Dynamics' })).toBeVisible({ timeout: 20000 });

    const control = page.getByRole('radiogroup');
    await expect(control).toHaveCount(1);
    await expect(control).toHaveAccessibleName('Period for Group Dynamics');
    await expect(page.getByRole('banner').getByRole('radiogroup')).toBeVisible();
    // 24h is gone; the default is 30d.
    await expect(control.getByRole('radio')).toHaveText(['7d', '30d', 'All']);
    await expect(control.getByRole('radio', { name: '30d' })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => everySectionAsked(asked, '30d')).toEqual(expected('30d'));

    await control.getByRole('radio', { name: '7d' }).click();
    await expect(control.getByRole('radio', { name: '7d' })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => everySectionAsked(asked, '7d')).toEqual(expected('7d'));
    // The sample Hall of Fame is empty: the card says which period is empty.
    await expect(page.getByText('Nobody shared, liked or listened in the last 7 days. Try All.')).toBeVisible();

    for (const name of Object.keys(sections)) delete asked[name];
    await page.reload();
    await expect(page.getByRole('radio', { name: '7d' })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => everySectionAsked(asked, '7d')).toEqual(expected('7d'));
  });
}
