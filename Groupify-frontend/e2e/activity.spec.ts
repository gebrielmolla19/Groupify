import { test, expect, type Page } from '@playwright/test';
import { openSampleActivity } from './support/sampleActivity';

// #57 slice 7: Activity. Sample data (see support/sampleActivity.ts): three
// new items (an invite, a share, a member joining) and two read shares.
const section = (page: Page, name: string) => page.getByRole('region', { name });
const railActivity = (page: Page) => page.getByRole('complementary').getByRole('button', { name: /^Activity/ });

test('says what is new, then lists it by age', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSampleActivity(page, { theme: 'dark' });

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('3 new things');
  await expect(page.getByText('1 invite, 1 new track and 1 new member.')).toBeVisible();
  await expect(section(page, 'Today').getByRole('listitem')).toHaveCount(2);
  await expect(section(page, 'This week').getByRole('listitem')).toHaveCount(2);
  await expect(section(page, 'Earlier').getByRole('listitem')).toHaveCount(1);
  await expect(page.getByTestId('unread-dot')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Activity, 3 new' })).toHaveAttribute('aria-current', 'page');
});

test('opening a share marks it read and opens its group', async ({ page }) => {
  const stub = await openSampleActivity(page, { theme: 'dark' });
  await page.getByRole('button', { name: /Test Friend shared Sample Track A/ }).click();

  await expect(page).toHaveURL(/\/groups\/g1$/);
  expect(stub.requests).toContain('PUT /notifications/n2/read');
  await expect(page.getByRole('button', { name: 'Activity, 2 new' })).toBeVisible();
});

test('an invite is accepted in place and opens the group', async ({ page }) => {
  const stub = await openSampleActivity(page, { theme: 'dark' });
  await page.getByRole('button', { name: 'Accept invite to Invite Group' }).click();

  await expect(page).toHaveURL(/\/groups\/g3$/);
  expect(stub.requests).toContain('POST /groups/g3/invite/i1/accept');
  // The joined group is in the rail straight away, without a reload.
  await expect(page.getByRole('navigation', { name: 'Groups' }).getByRole('button', { name: /Invite Group/ })).toBeVisible();
});

test('mark all read leaves nothing new, everywhere', async ({ page }) => {
  const stub = await openSampleActivity(page, { theme: 'light' });
  await page.getByRole('button', { name: 'Mark all read' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText("You're all caught up");
  await expect(page.getByTestId('unread-dot')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark all read' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Activity', exact: true })).toBeVisible();
  expect(stub.requests).toContain('PUT /notifications/read-all');
});

test('with no activity it says what will show up', async ({ page }) => {
  await openSampleActivity(page, { theme: 'dark', empty: true });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('No activity yet');
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(0);
});

test('a failed load says so, claims nothing, and can retry', async ({ page }) => {
  const stub = await openSampleActivity(page, { theme: 'dark', fails: true });
  const alert = page.getByRole('alert').filter({ hasText: "Couldn't load your activity." });
  await expect(alert).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Activity');

  stub.recover();
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('3 new things');
  await expect(alert).toHaveCount(0);
});

test('Home no longer has a notifications menu; the rail leads to Activity', async ({ page }) => {
  await openSampleActivity(page, { theme: 'dark', path: '/' });
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveCount(0);
  await railActivity(page).click();
  await expect(page).toHaveURL(/\/activity$/);
});

test('at 375px Activity fits, with 44px controls and a tab with the count', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openSampleActivity(page, { theme: 'dark', path: '/' });
  const tab = page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Activity, 3 new' });
  await expect(tab).toContainText('3');
  await tab.click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('3 new things');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  for (const name of ['Mark all read', 'Accept invite to Invite Group', 'Decline invite to Invite Group', /Test Friend shared Sample Track A/]) {
    const box = (await page.getByRole('button', { name }).boundingBox())!;
    expect(box.height, String(name)).toBeGreaterThanOrEqual(44);
  }
});
