import { test, expect, type Page } from '@playwright/test';
import { openSampleFeed } from './support/sampleFeed';

// #57 slice 4: feed filters. Sample feed (see support/sampleFeed.ts):
// 1 shared by me; 2 shared by a friend, not heard by me; 3 shared by me, liked by me.
const filters = (page: Page) => page.getByRole('radiogroup', { name: 'Filter shares' });
const chip = (page: Page, name: string) => filters(page).getByRole('radio', { name: new RegExp(`^${name} \\d+$`) });
const shown = async (page: Page) =>
  page.getByRole('list', { name: 'Shares' }).getByRole('listitem').evaluateAll((rows) => rows.map((r) => r.textContent?.match(/(Sample|Older) Track \d/)?.[0]));

test('filters the feed with a count on each chip', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSampleFeed(page, { theme: 'dark' });

  for (const [name, count] of [['All', 3], ['Unheard', 1], ['Yours', 2], ['Liked', 1]] as const) {
    await expect(chip(page, name)).toHaveAccessibleName(`${name} ${count}`);
  }
  await expect(chip(page, 'All')).toHaveAttribute('aria-checked', 'true');

  await chip(page, 'Unheard').click();
  await expect(chip(page, 'Unheard')).toHaveAttribute('aria-checked', 'true');
  await expect(chip(page, 'All')).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => shown(page)).toEqual(['Sample Track 2']);

  await chip(page, 'Yours').click();
  await expect.poll(() => shown(page)).toEqual(['Sample Track 1', 'Sample Track 3']);

  // Pressing the selected chip again keeps it selected.
  await chip(page, 'Yours').click();
  await expect(chip(page, 'Yours')).toHaveAttribute('aria-checked', 'true');

  await chip(page, 'All').click();
  await expect.poll(() => shown(page)).toEqual(['Sample Track 1', 'Sample Track 2', 'Sample Track 3']);

  // Keyboard: arrows move between chips, Space selects.
  await chip(page, 'All').focus();
  await page.keyboard.press('ArrowRight');
  await expect(chip(page, 'Unheard')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(chip(page, 'Unheard')).toHaveAttribute('aria-checked', 'true');
});

test('an empty filter says so instead of showing a blank list', async ({ page }) => {
  await openSampleFeed(page, { theme: 'dark' });
  await chip(page, 'Liked').click();
  await expect.poll(() => shown(page)).toEqual(['Sample Track 3']);

  await page.getByRole('button', { name: /^Unlike Sample Track 3/ }).click();
  await expect(page.getByText("You haven't liked a track here yet.")).toBeVisible();
  await expect(page.getByRole('list', { name: 'Shares' })).toHaveCount(0);
  await expect(chip(page, 'Liked')).toHaveAccessibleName('Liked 0');
});

test('at 375px the chips fit without page scroll, with 44px targets', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openSampleFeed(page, { theme: 'dark' });
  await expect(chip(page, 'All')).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  for (const name of ['All', 'Unheard', 'Yours', 'Liked']) {
    const box = (await chip(page, name).boundingBox())!;
    expect(box.height, name).toBeGreaterThanOrEqual(44);
    expect(box.width, name).toBeGreaterThanOrEqual(44);
  }
});

// Each group starts on All (the route remounts the feed per path, App.tsx).
test('switching groups goes back to All', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSampleFeed(page, { theme: 'dark', secondGroup: true });
  await chip(page, 'Liked').click();
  await expect(chip(page, 'Liked')).toHaveAttribute('aria-checked', 'true');

  await page.getByText('Second Group').first().click();
  await expect(page).toHaveURL(/\/groups\/g2$/);
  await page.getByText('Sample Group').first().click();
  await expect(page).toHaveURL(/\/groups\/g1$/);
  await expect(chip(page, 'All')).toHaveAttribute('aria-checked', 'true');
});

// Home's per-group links open the feed on Unheard.
test('?filter=unheard opens the feed on Unheard', async ({ page }) => {
  await openSampleFeed(page, { theme: 'dark' });
  await page.goto('/groups/g1?filter=unheard');
  await expect(chip(page, 'Unheard')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => shown(page)).toEqual(['Sample Track 2']);

  await page.goto('/groups/g1?filter=nonsense');
  await expect(chip(page, 'All')).toHaveAttribute('aria-checked', 'true');
});

// The feed loads only its newest page; a backlog lives past it (#117 review).
test('Unheard includes older unheard shares beyond the loaded page', async ({ page }) => {
  await openSampleFeed(page, { theme: 'dark', olderUnheard: 2 });
  await page.goto('/groups/g1?filter=unheard');
  await expect(chip(page, 'Unheard')).toHaveAccessibleName('Unheard 3');
  await expect.poll(() => shown(page)).toEqual(['Sample Track 2', 'Older Track 2', 'Older Track 1']);
  await expect(page.getByText("couldn't be loaded here")).toHaveCount(0);
});

test('if older unheard shares fail to load, Unheard says so instead of "heard everything"', async ({ page }) => {
  await openSampleFeed(page, { theme: 'dark', olderUnheard: 2, olderUnheardFails: true });
  await page.goto('/groups/g1?filter=unheard');
  await expect(page.getByText("Some older unheard tracks couldn't be loaded here.")).toBeVisible();
  await expect(page.getByText("You've heard everything")).toHaveCount(0);
});
