import { test, expect, type Page } from '@playwright/test';
import { openSamplePlaylist } from './support/samplePlaylist';

// #57 slice 6: the group playlist. Sample data (see support/samplePlaylist.ts):
// six tracks, 24 minutes, shared by three members; most listened is track 3.
const tracks = (page: Page) => page.getByRole('list', { name: 'Playlist tracks' }).getByRole('listitem');
const sort = (page: Page) => page.getByRole('radiogroup', { name: 'Sort playlist' });

test('says what the playlist holds, then lists it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSamplePlaylist(page, { theme: 'dark' });

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sample Group');
  await expect(page.getByText('6 tracks from 3 members, 24m to play through.')).toBeVisible();
  await expect(tracks(page)).toHaveCount(6);
  await expect(tracks(page).first()).toContainText('Playlist Track 3');
  await expect(tracks(page).first()).toContainText('3 listens');
  await expect(tracks(page).nth(1)).toContainText('You');
  await expect(page.getByRole('button', { name: 'Play Playlist Track 3 by Sample Artist 3' })).toBeVisible();
});

test('the sort chips reorder the playlist', async ({ page }) => {
  await openSamplePlaylist(page, { theme: 'dark' });
  await expect(sort(page).getByRole('radio', { name: 'Most listened' })).toHaveAttribute('aria-checked', 'true');

  await sort(page).getByRole('radio', { name: 'Newest' }).click();
  await expect(tracks(page).first()).toContainText('Playlist Track 6');
  await sort(page).getByRole('radio', { name: 'A–Z' }).click();
  await expect(tracks(page).first()).toContainText('Playlist Track 1');
  // Pressing the selected chip again keeps it selected.
  await sort(page).getByRole('radio', { name: 'A–Z' }).click();
  await expect(sort(page).getByRole('radio', { name: 'A–Z' })).toHaveAttribute('aria-checked', 'true');
});

test('offers the Spotify action that fits the viewer', async ({ page }) => {
  await openSamplePlaylist(page, { theme: 'dark' });
  await expect(page.getByRole('button', { name: 'Create collaborative playlist' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Follow collaborative playlist' })).toHaveCount(0);
});

test('a member who does not own the Spotify playlist can follow it', async ({ page }) => {
  await openSamplePlaylist(page, { theme: 'dark', spotify: 'theirs' });
  await expect(page.getByRole('button', { name: 'Follow collaborative playlist' })).toBeVisible();
  await expect(page.getByRole('button', { name: /(Create|Update) collaborative playlist/ })).toHaveCount(0);
});

test('the owner of the Spotify playlist can update it', async ({ page }) => {
  await openSamplePlaylist(page, { theme: 'light', spotify: 'mine' });
  await expect(page.getByRole('button', { name: 'Update collaborative playlist' })).toBeVisible();
});

test('an empty playlist points to the group feed', async ({ page }) => {
  await openSamplePlaylist(page, { theme: 'dark', empty: true });
  await expect(page.getByText('Nothing to play yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play all tracks in playlist' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Go to the group feed' }).click();
  await expect(page).toHaveURL(/\/groups\/g1$/);
});

test('a failed load says so and can retry', async ({ page }) => {
  const stub = await openSamplePlaylist(page, { theme: 'dark', fails: true });
  const alert = page.getByRole('alert').filter({ hasText: "Couldn't load this playlist." });
  await expect(alert).toBeVisible();
  await expect(page.getByText('Nothing to play yet')).toHaveCount(0);

  stub.recover();
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(tracks(page)).toHaveCount(6);
  await expect(alert).toHaveCount(0);
});

test('at 375px the playlist fits, with 44px controls', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openSamplePlaylist(page, { theme: 'dark' });
  await expect(tracks(page)).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  for (const name of ['Back to group feed', 'View group analytics', 'Play all tracks in playlist', 'Create collaborative playlist', 'Play Playlist Track 3 by Sample Artist 3']) {
    const box = (await page.getByRole('button', { name }).boundingBox())!;
    expect(box.height, name).toBeGreaterThanOrEqual(44);
    expect(box.width, name).toBeGreaterThanOrEqual(44);
  }
  for (const chip of await sort(page).getByRole('radio').all()) {
    const box = (await chip.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    // All four chips fit without scrolling their row.
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  }
});
