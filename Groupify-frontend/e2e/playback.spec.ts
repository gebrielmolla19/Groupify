import { test, expect, type Page } from '@playwright/test';
import { openPlayer, readLog, remotePlayback, spotify, stateFor, waitForDevice } from './support/fakeSpotify';

// #76 tier 1: the playback checklist against a fake Web Playback SDK and a
// stubbed backend (see support/fakeSpotify.ts). These assert the calls the
// app makes to Spotify, which is what the playback invariants are about
// (groupify-playback skill). Real audio is tier 3.

const player = (page: Page) => page.getByTestId('spotify-player');
const apiCalls = async (page: Page, prefix: string) => (await readLog(page)).filter((l) => l.startsWith(`api:${prefix}`));
const playRequest = (track: string, device = 'web1') =>
  `api:PUT /player/play ${JSON.stringify({ device_id: device, track_uri: `spotify:track:${track}` })}`;

async function playFromFeed(page: Page, n: number) {
  await page.getByRole('button', { name: `Play Sample Track ${n}` }).click();
  await expect(player(page)).toContainText(`Sample Track ${n}`);
}

test('opening the app neither transfers nor starts playback (invariant 2)', async ({ page }) => {
  await openPlayer(page);
  await waitForDevice(page);
  // Give a transfer-on-ready a chance to happen.
  await page.waitForTimeout(1500);
  const log = await readLog(page);
  expect(log.filter((l) => /^api:\w+ \/player\/(?!playback|devices)/.test(l))).toEqual([]);
  expect(log.filter((l) => /^sdk:(togglePlay|resume|activateElement)/.test(l))).toEqual([]);
});

test('playing a share targets the SDK device, after activateElement in the tap', async ({ page }) => {
  await openPlayer(page);
  await waitForDevice(page);
  await playFromFeed(page, 2);
  const log = await readLog(page);
  const play = log.indexOf(playRequest('t2'));
  expect(play).toBeGreaterThan(-1);
  expect(log.lastIndexOf('sdk:activateElement', play)).toBeGreaterThan(-1);
  expect(await apiCalls(page, 'PUT /player/transfer')).toEqual([]);
});

test('pause calls activateElement() and then togglePlay()', async ({ page }) => {
  await openPlayer(page);
  await waitForDevice(page);
  await playFromFeed(page, 1);
  await player(page).getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(player(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  const log = await readLog(page);
  expect(log.slice(-2)).toEqual(['sdk:activateElement', 'sdk:togglePlay']);
});

test('next and previous play the neighbouring shares in the group playlist', async ({ page }) => {
  await openPlayer(page);
  await waitForDevice(page);
  await playFromFeed(page, 1);

  await player(page).getByRole('button', { name: 'Next track' }).click();
  await expect(player(page)).toContainText('Sample Track 2');
  await player(page).getByRole('button', { name: 'Previous track' }).click();
  await expect(player(page)).toContainText('Sample Track 1');
  // Previous from the first share wraps to the last.
  await player(page).getByRole('button', { name: 'Previous track' }).click();
  await expect(player(page)).toContainText('Sample Track 3');

  expect(await apiCalls(page, 'PUT /player/play')).toEqual([playRequest('t1'), playRequest('t2'), playRequest('t1'), playRequest('t3')]);
});

test('seek works by keyboard and by click', async ({ page }) => {
  await openPlayer(page);
  await waitForDevice(page);
  await playFromFeed(page, 1);
  await spotify.setState(page, stateFor('t1', { paused: true, position: 106000, duration: 269000 }));
  const slider = player(page).getByRole('slider');
  await expect(slider).toHaveAttribute('aria-valuenow', '106000');

  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await readLog(page)).at(-1)).toBe('sdk:seek 107000');

  // 75% of 269000 is 201750; the slider steps by whole seconds.
  const track = player(page).locator('span[aria-label="Seek"]');
  const box = (await track.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect.poll(async () => {
    const seek = (await readLog(page)).filter((l) => l.startsWith('sdk:seek ')).at(-1)!;
    return Math.abs(Number(seek.split(' ')[1]) - 201750);
  }).toBeLessThanOrEqual(1500);
});

test('the device picker transfers to exactly the chosen device (invariant 1)', async ({ page }) => {
  await openPlayer(page);
  await waitForDevice(page);
  await player(page).getByRole('button', { name: /playback device/i }).click();
  await page.getByRole('combobox', { name: 'Select Spotify playback device' }).click();
  await page.getByRole('option', { name: 'Living Room Speaker' }).click();
  await expect.poll(() => apiCalls(page, 'PUT /player/transfer')).toEqual([
    `api:PUT /player/transfer ${JSON.stringify({ device_id: 'spk', play: false })}`,
  ]);
  expect(await apiCalls(page, 'PUT /player/play')).toEqual([]);
});

test('a track that ends auto-advances and is marked as listened', async ({ page }) => {
  await openPlayer(page);
  await waitForDevice(page);
  await playFromFeed(page, 1);
  await spotify.setState(page, stateFor('t1', { position: 199500 }));

  await expect(player(page)).toContainText('Sample Track 2');
  await expect.poll(() => apiCalls(page, 'POST /shares/')).toEqual(['api:POST /shares/sh1/listen']);
  expect(await apiCalls(page, 'PUT /player/play')).toEqual([playRequest('t1'), playRequest('t2')]);
});

test('a 404 on play reconnects and retries only the same device, with one toast (invariants 1 and 3)', async ({ page }) => {
  await openPlayer(page, { playStatuses: [404] });
  await waitForDevice(page);
  await page.getByRole('button', { name: 'Play Sample Track 1' }).click();

  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(1);
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toContainText('Lost connection to the Spotify player');
  // Force reconnect: disconnect, then connect again (which re-registers the device).
  await expect.poll(async () => (await readLog(page)).filter((l) => /^sdk:(dis)?connect$/.test(l))).toEqual(['sdk:connect', 'sdk:disconnect', 'sdk:connect']);
  await waitForDevice(page);

  await playFromFeed(page, 1);
  expect(await apiCalls(page, 'PUT /player/play')).toEqual([playRequest('t1'), playRequest('t1')]);
  expect(await apiCalls(page, 'PUT /player/transfer')).toEqual([]);
});

test('not_ready reconnects the player', async ({ page }) => {
  await openPlayer(page);
  await waitForDevice(page);
  await spotify.emit(page, 'not_ready', { device_id: 'web1' });
  await expect.poll(async () => (await readLog(page)).filter((l) => l === 'sdk:connect').length).toBe(2);
  await waitForDevice(page);
});

test('Sign Out disconnects the player (invariant 6)', async ({ page }) => {
  await openPlayer(page);
  await waitForDevice(page);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect.poll(() => readLog(page)).toContain('sdk:disconnect');
});

test('remote mode shows the other device and controls it', async ({ page }) => {
  await openPlayer(page, { remote: remotePlayback });
  await expect(player(page)).toContainText('Remote Song');
  await expect(player(page)).toContainText('Playing on Pixel');

  await player(page).getByRole('button', { name: 'Pause', exact: true }).click();
  await player(page).getByRole('button', { name: 'Next track' }).click();
  await expect.poll(async () => (await readLog(page)).filter((l) => /^api:\w+ \/player\/(pause|next)/.test(l))).toEqual([
    `api:PUT /player/pause ${JSON.stringify({ device_id: 'phone1' })}`,
    `api:POST /player/next ${JSON.stringify({ device_id: 'phone1' })}`,
  ]);
  expect(await apiCalls(page, 'PUT /player/transfer')).toEqual([]);
});

test("a browser without EME says it can't play, instead of spinning", async ({ page }) => {
  await openPlayer(page, { initError: true });
  await expect(player(page)).toContainText('Player error');
  await expect(player(page)).toContainText("This browser can't play Spotify audio");
});

test('phone mini player: previous, play/pause and next', async ({ page }) => {
  await openPlayer(page, { viewport: { width: 375, height: 812 } });
  await waitForDevice(page);
  await playFromFeed(page, 2);

  await player(page).getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(player(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  expect((await readLog(page)).slice(-2)).toEqual(['sdk:activateElement', 'sdk:togglePlay']);

  await player(page).getByRole('button', { name: 'Next track' }).click();
  await expect(player(page)).toContainText('Sample Track 3');
  await player(page).getByRole('button', { name: 'Previous track' }).click();
  await expect(player(page)).toContainText('Sample Track 2');
});
