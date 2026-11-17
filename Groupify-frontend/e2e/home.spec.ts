import { test, expect } from '@playwright/test';
import { openSampleHome } from './support/sampleHome';

// #57 slice 5: Home. Sample data (see support/sampleHome.ts): three groups,
// three unheard shares (two in Sample Group, one in Second Group), oldest 5 days.
const waiting = (page: import('@playwright/test').Page) => page.getByRole('list', { name: 'Waiting for you' });

test('says what is waiting, then lists it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSampleHome(page, { theme: 'dark' });

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('3 tracks are waiting for you');
  await expect(page.getByText('Across 2 groups. The oldest has been sitting for 5 days.')).toBeVisible();
  await expect(waiting(page).getByRole('listitem')).toHaveCount(3);
  await expect(waiting(page).getByRole('link').first()).toContainText('Waiting Track 1');
  await expect(waiting(page).getByRole('link').first()).toContainText('Sample Group · Test Friend · 1d');

  await waiting(page).getByRole('link', { name: /Waiting Track 2/ }).click();
  await expect(page).toHaveURL(/\/groups\/g2$/);
});

test('each group card shows its unheard count and opens the group', async ({ page }) => {
  await openSampleHome(page, { theme: 'dark' });
  const groups = page.getByRole('region', { name: 'Your groups' });
  await expect(groups.getByRole('link', { name: /Sample Group/ })).toContainText('2 unheard');
  await expect(groups.getByRole('link', { name: /Second Group/ })).toContainText('1 unheard');
  await expect(groups.getByRole('link', { name: /Quiet Group/ })).not.toContainText('unheard');
  await groups.getByRole('link', { name: /Quiet Group/ }).click();
  await expect(page).toHaveURL(/\/groups\/g3$/);
});

test('copies a group join code', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openSampleHome(page, { theme: 'dark' });
  await page.getByRole('button', { name: 'Copy join code for Second Group' }).click();
  await expect(page.getByRole('button', { name: 'Copy join code for Second Group' })).toContainText('CODEG2');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('CODEG2');
});

test('says when you are all caught up', async ({ page }) => {
  await openSampleHome(page, { theme: 'dark', caughtUp: true });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("You're all caught up");
  await expect(waiting(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your groups' })).toBeVisible();
});

test('without groups it asks you to start one', async ({ page }) => {
  await openSampleHome(page, { theme: 'dark', noGroups: true });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Start a group');
  await expect(page.getByRole('button', { name: 'Create your first group' })).toBeVisible();
});

test('a failed load says so, claims nothing, and can retry', async ({ page }) => {
  await openSampleHome(page, { theme: 'dark', unheardFails: 1 });
  const alert = page.getByRole('alert').filter({ hasText: "Couldn't load the tracks waiting for you." });
  await expect(alert).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');
  await expect(page.getByRole('heading', { name: 'Your groups' })).toBeVisible();

  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('3 tracks are waiting for you');
  await expect(alert).toHaveCount(0);
  await expect(waiting(page).getByRole('listitem')).toHaveCount(3);
});

test('at 375px Home fits, with 44px controls', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openSampleHome(page, { theme: 'dark' });
  await expect(waiting(page).getByRole('listitem')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  for (const name of ['Join a group', 'Create new group', 'Copy join code for Sample Group']) {
    const box = (await page.getByRole('button', { name }).boundingBox())!;
    expect(box.height, name).toBeGreaterThanOrEqual(44);
  }
  for (const link of await waiting(page).getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});
