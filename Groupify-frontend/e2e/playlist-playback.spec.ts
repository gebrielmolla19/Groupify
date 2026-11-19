import { test, expect, type Page } from '@playwright/test';
import { openPlayer, readLog, shares, waitForDevice } from './support/fakeSpotify';

// Playback from the group playlist screen, against the fake Web Playback SDK
// (see support/fakeSpotify.ts and playback.spec.ts, which covers the feed).
// Asserts the calls the app makes to Spotify; real audio is the smoke test.

const player = (page: Page) => page.getByTestId('spotify-player');
const apiCalls = async (page: Page, prefix: string) => (await readLog(page)).filter((l) => l.startsWith(`api:${prefix}`));
const playRequest = (track: string) =>
  `api:PUT /player/play ${JSON.stringify({ device_id: 'web1', track_uri: `spotify:track:${track}` })}`;

/**
 * Give the shares listen counts so "Most listened" (t3, t1, t2) differs from
 * "Newest" (t1, t2, t3), then reload so the playlist and player load them.
 */
async function withListens(page: Page) {
  const counts: Record<string, number> = { t1: 1, t2: 0, t3: 2 };
  await page.route('**/api/v1/shares/groups/g1**', (route) => route.fulfill({
    json: { success: true, shares: shares.map((s) => ({ ...s, listenCount: counts[s.spotifyTrackId] })), total: shares.length, limit: 100, offset: 0 },
  }));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play Sample Track 1 by Sample Artist' })).toBeVisible();
}

test('Play all plays the first track on the SDK device, after activateElement, without a transfer', async ({ page }) => {
  await openPlayer(page, { path: '/groups/g1/playlist' });
  await waitForDevice(page);
  await page.getByRole('button', { name: 'Play all tracks in playlist' }).click();

  await expect(player(page)).toContainText('Sample Track 1');
  const log = await readLog(page);
  const play = log.indexOf(playRequest('t1'));
  expect(play).toBeGreaterThan(-1);
  expect(log.lastIndexOf('sdk:activateElement', play)).toBeGreaterThan(-1);
  expect(await apiCalls(page, 'PUT /player/transfer')).toEqual([]);
});

test("tapping a row plays that row's track", async ({ page }) => {
  await openPlayer(page, { path: '/groups/g1/playlist' });
  await waitForDevice(page);
  // The row body, not its play button: both should start the track.
  await page.getByRole('listitem').filter({ hasText: 'Sample Track 2' }).getByText('Sample Track 2').click();

  await expect(player(page)).toContainText('Sample Track 2');
  expect(await apiCalls(page, 'PUT /player/play')).toEqual([playRequest('t2')]);
});

test("tapping a row before the player connects says it isn't ready", async ({ page }) => {
  await openPlayer(page, { path: '/groups/g1/playlist', initError: true });
  await page.getByRole('listitem').filter({ hasText: 'Sample Track 2' }).getByText('Sample Track 2').click();

  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Player is not ready' })).toHaveCount(1);
  expect(await apiCalls(page, 'PUT /player/play')).toEqual([]);
});

test("next and previous follow the playlist's sort", async ({ page }) => {
  await openPlayer(page, { path: '/groups/g1/playlist' });
  await withListens(page);
  await waitForDevice(page);

  // Most listened (the default): t3, t1, t2.
  await page.getByRole('button', { name: 'Play all tracks in playlist' }).click();
  await expect(player(page)).toContainText('Sample Track 3');
  await player(page).getByRole('button', { name: 'Next track' }).click();
  await expect(player(page)).toContainText('Sample Track 1');

  // Newest: t1, t2, t3.
  await page.getByRole('radiogroup', { name: 'Sort playlist' }).getByRole('radio', { name: 'Newest' }).click();
  await player(page).getByRole('button', { name: 'Next track' }).click();
  await expect(player(page)).toContainText('Sample Track 2');
  await player(page).getByRole('button', { name: 'Previous track' }).click();
  await expect(player(page)).toContainText('Sample Track 1');

  expect(await apiCalls(page, 'PUT /player/play')).toEqual([playRequest('t3'), playRequest('t1'), playRequest('t2'), playRequest('t1')]);
});
