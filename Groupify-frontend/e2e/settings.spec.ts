import { test, expect, type Page } from '@playwright/test';
import { openSampleSettings } from './support/sampleSettings';

// #57 slice 8: Profile and Group settings. Sample data (support/sampleSettings.ts):
// the signed-in user owns Sample Group (g1) and is a member of Second Group (g2).
const section = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

async function fitsAt390(page: Page, controls: (string | RegExp)[], role: 'button' | 'radio' = 'button') {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const name of controls) {
    const box = (await page.getByRole('main').getByRole(role, { name }).first().boundingBox())!;
    expect(box.height, String(name)).toBeGreaterThanOrEqual(44);
  }
}

for (const theme of ['dark', 'light'] as const) {
  test(`profile says who you are, then shows your numbers and settings (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSampleSettings(page, { theme, path: '/profile' });

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sample User');
    await expect(page.getByText('Signed in with Spotify as sample.user')).toBeVisible();
    const numbers = section(page, 'Your numbers');
    await expect(numbers).toContainText('12Tracks shared');
    await expect(numbers).toContainText('48Listens');
    await expect(numbers).toContainText('2Groups');
    for (const name of ['Account', 'Notifications', 'Appearance', 'Account access']) {
      await expect(section(page, name)).toBeVisible();
    }
    await expect(page.getByRole('switch', { name: /Group invites/ })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('switch', { name: /New tracks/ })).toHaveAttribute('aria-checked', 'true');
    // Phones only.
    await expect(page.getByRole('navigation', { name: 'More' })).toBeHidden();
  });

  test(`group settings for the owner: members, join code and delete (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSampleSettings(page, { theme, path: '/groups/g1/settings' });

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sample Group');
    await expect(page.getByText('3 members · You own this group')).toBeVisible();
    const members = section(page, 'Members');
    await expect(members.getByRole('listitem')).toHaveCount(3);
    await expect(members.getByRole('listitem').filter({ hasText: 'Sample User' })).toContainText('Owner');
    await expect(members.getByRole('button', { name: /^Remove / })).toHaveCount(2);
    await expect(section(page, 'Join code')).toContainText('SAMPLEG1CODE0000');
    await expect(section(page, 'Delete group').getByRole('button', { name: 'Delete group' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave group' })).toHaveCount(0);
  });
}

test('a member sees who owns the group, cannot remove anyone, and can leave', async ({ page }) => {
  await openSampleSettings(page, { theme: 'dark', path: '/groups/g2/settings' });
  await expect(page.getByText('3 members · Test Friend owns this group')).toBeVisible();
  await expect(section(page, 'Members').getByRole('button', { name: /^Remove / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete group' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Leave group' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Are you sure you want to leave');
});

test('editing the name saves only what changed', async ({ page }) => {
  const stub = await openSampleSettings(page, { theme: 'dark', path: '/groups/g1/settings' });
  const save = page.getByRole('button', { name: 'Save changes' });
  await expect(save).toBeDisabled();
  await page.getByLabel('Name', { exact: true }).fill('Renamed Group');
  await expect(save).toBeEnabled();
  await save.click();
  await expect.poll(() => stub.requests).toContain('PATCH /groups/g1/settings');
});

test('the join code copies', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openSampleSettings(page, { theme: 'dark', path: '/groups/g1/settings' });
  await page.getByRole('button', { name: 'Copy join code' }).click();
  await expect(page.getByRole('button', { name: 'Copy join code' })).toContainText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('SAMPLEG1CODE0000');
});

test('at 390px Profile fits, with 44px controls and the More links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSampleSettings(page, { theme: 'dark', path: '/profile' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sample User');
  await expect(page.getByRole('navigation', { name: 'More' })).toBeVisible();
  await fitsAt390(page, ['Save changes', 'Sign out', 'Take the tour']);
  await fitsAt390(page, ['Dark', 'Light', 'Device'], 'radio');
});

test('at 390px Group settings fits, with 44px controls and links to the group screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSampleSettings(page, { theme: 'light', path: '/groups/g1/settings' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sample Group');
  await fitsAt390(page, ['Back to group feed', 'Playlist', 'Group Dynamics', /^Remove /, 'Copy join code', 'Save changes', 'Delete group']);
  await page.getByRole('navigation', { name: 'Group' }).getByRole('button', { name: 'Playlist' }).click();
  await expect(page).toHaveURL(/\/groups\/g1\/playlist$/);
});
