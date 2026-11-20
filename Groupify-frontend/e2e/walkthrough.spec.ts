import { test, expect, type Locator, type Page } from '@playwright/test';
import { openSampleFeed } from './support/sampleFeed';

// #57 slice 10: the four-step walkthrough over the group feed. Sample feed
// (see support/sampleFeed.ts): Sample Track 2 is the one the viewer hasn't heard.
const tour = (page: Page) => page.getByRole('dialog');
const spotlight = (page: Page) => page.getByTestId('tour-spotlight');
const row = (page: Page, n: number) => page.getByRole('list', { name: 'Shares' }).getByRole('listitem').filter({ hasText: `Sample Track ${n}` });

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('not visible');
  return b;
}

/** The spotlight is drawn around the element, 6px out on every side. */
async function expectSpotlightAround(page: Page, target: Locator) {
  await expect(async () => {
    const s = await box(spotlight(page));
    const t = await box(target);
    expect(Math.abs(s.x - (t.x - 6))).toBeLessThan(2);
    expect(Math.abs(s.y - (t.y - 6))).toBeLessThan(2);
    expect(Math.abs(s.width - (t.width + 12))).toBeLessThan(2);
    expect(Math.abs(s.height - (t.height + 12))).toBeLessThan(2);
  }).toPass({ timeout: 3000 });
}

/** The card is inside the viewport and doesn't cover the spotlit element. */
async function expectCardClear(page: Page) {
  // Retried: the spotlight glides to each new target.
  await expect(async () => {
    const c = await box(tour(page));
    const s = await box(spotlight(page));
    const vp = page.viewportSize()!;
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(vp.width);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.y + c.height).toBeLessThanOrEqual(vp.height);
    const overlaps = c.x < s.x + s.width && s.x < c.x + c.width && c.y < s.y + s.height && s.y < c.y + c.height;
    expect(overlaps).toBe(false);
  }).toPass({ timeout: 3000 });
}

for (const theme of ['dark', 'light'] as const) {
  test(`desktop ${theme}: four steps spotlight the share box, the unheard row, the heard stack and the detail`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSampleFeed(page, { theme, tour: true });

    await expect(tour(page)).toHaveAccessibleName('Share a song here');
    await expect(tour(page)).toContainText('1 of 4');
    await expectSpotlightAround(page, page.locator('[data-tour="share-input"]'));
    await expectCardClear(page);
    // The outline is the iris token, not a hard-coded colour.
    const iris = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--iris').trim());
    const border = await spotlight(page).evaluate((el) => getComputedStyle(el).borderTopColor);
    const expected = await page.evaluate((c) => { const el = document.createElement('i'); el.style.color = c; document.body.append(el); const v = getComputedStyle(el).color; el.remove(); return v; }, iris);
    expect(border).toBe(expected);

    await tour(page).getByRole('button', { name: 'Next' }).click();
    await expect(tour(page)).toHaveAccessibleName('A dot means unheard');
    await expectSpotlightAround(page, row(page, 2));
    await expectCardClear(page);

    await tour(page).getByRole('button', { name: 'Next' }).click();
    await expect(tour(page)).toHaveAccessibleName('See who has listened');
    // At this width the row shows the avatar stack, not the inline count.
    await expectSpotlightAround(page, row(page, 1).getByRole('group'));
    await expectCardClear(page);

    await tour(page).getByRole('button', { name: 'Next' }).click();
    await expect(tour(page)).toHaveAccessibleName('Everything about one song');
    await expectSpotlightAround(page, row(page, 1));
    // Opening a song moves the spotlight to its detail pane.
    await row(page, 3).getByRole('button', { name: 'Show details for Sample Track 3' }).click({ position: { x: 400, y: 20 } });
    const pane = page.getByRole('complementary', { name: 'Song details' });
    await expectSpotlightAround(page, pane.locator('[data-tour="song-detail"]'));
    await expectCardClear(page);

    await tour(page).getByRole('button', { name: 'Done' }).click();
    await expect(tour(page)).toHaveCount(0);
    await expect(spotlight(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByPlaceholder(/Search and add a track/)).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(tour(page)).toHaveCount(0);
  });
}

test('phone: every step fits at 390px, above the player and tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSampleFeed(page, { theme: 'dark', tour: true });
  const tabs = page.getByRole('navigation').last();

  for (const title of ['Share a song here', 'A dot means unheard', 'See who has listened', 'Everything about one song']) {
    await expect(tour(page)).toHaveAccessibleName(title);
    await expect(spotlight(page)).toBeVisible();
    await expectCardClear(page);
    const c = await box(tour(page));
    expect(c.y + c.height).toBeLessThanOrEqual((await box(tabs)).y);
    for (const button of await tour(page).getByRole('button').all()) expect((await box(button)).height).toBeGreaterThanOrEqual(44);
    const next = tour(page).getByRole('button', { name: /Next|Done/ });
    await next.click();
  }
  await expect(tour(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('the tour restarts from Take the tour, and Escape skips it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSampleFeed(page, { theme: 'dark' });
  await expect(tour(page)).toHaveCount(0);
  await page.getByRole('button', { name: /Take the tour/ }).click();
  await expect(tour(page)).toHaveAccessibleName('Share a song here');
  await page.keyboard.press('Escape');
  await expect(tour(page)).toHaveCount(0);
});
