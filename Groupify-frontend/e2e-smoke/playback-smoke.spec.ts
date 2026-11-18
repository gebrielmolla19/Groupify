// #76 tier 3: real playback on the owner's Spotify account, run on demand
// (playback-smoke workflow). Spotify's own state, read through the Web API,
// is the oracle: no assertion trusts what Groupify's UI says.
//
// Needs: the backend at SMOKE_API_URL with E2E_TEST_LOGIN=true and
// SPOTIFY_TEST_REFRESH_TOKEN, and SMOKE_TRACK_IDS (three short tracks).
// Each play is kept to a few seconds, and everything is paused at the end.
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:5001/api/v1';
const TRACKS = (process.env.SMOKE_TRACK_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const WEB_PLAYER = 'Groupify Web Player';
const SPEAKER = 'Groupify Test Speaker';

// `linked_from`: Spotify can relink a track to another ID for the market.
interface Playback { is_playing: boolean; progress_ms: number; item: { id: string; duration_ms: number; linked_from?: { id: string } } | null; device: { id: string; name: string } }
interface Device { id: string; name: string; is_active: boolean }
interface Share { _id: string; spotifyTrackId: string; trackName: string; listeners: { user: { _id: string } | string }[] }

/** Signs in the seeded smoke user through /auth/test-login. Returns the Groupify JWT. */
async function signIn(request: APIRequestContext) {
  const res = await request.get(`${API}/auth/test-login`, { maxRedirects: 0 });
  const code = new URL(res.headers().location).searchParams.get('code');
  const exchange = await request.post(`${API}/auth/exchange-code`, { data: { code } });
  expect(exchange.ok(), 'test-login is on (E2E_TEST_LOGIN=true)').toBeTruthy();
  return (await exchange.json()).token as string;
}

/** Spotify's Web API with the smoke user's token, which the backend refreshes. */
function spotifyApi(request: APIRequestContext, jwt: string) {
  const accessToken = async () => {
    const res = await request.get(`${API}/auth/spotify-token`, { headers: { Authorization: `Bearer ${jwt}` } });
    expect(res.ok(), 'the backend has a working Spotify token (SPOTIFY_TEST_REFRESH_TOKEN)').toBeTruthy();
    return (await res.json()).accessToken as string;
  };
  const call = async (method: string, path: string, data?: unknown) =>
    request.fetch(`https://api.spotify.com/v1${path}`, { method, headers: { Authorization: `Bearer ${await accessToken()}` }, data });
  return {
    accessToken,
    playback: async (): Promise<Playback | null> => {
      const res = await call('GET', '/me/player');
      return res.status() === 200 ? res.json() : null;
    },
    devices: async (): Promise<Device[]> => (await (await call('GET', '/me/player/devices')).json()).devices ?? [],
    play: (deviceId: string, uris: string[]) => call('PUT', `/me/player/play?device_id=${deviceId}`, { uris }),
    pause: () => call('PUT', '/me/player/pause'),
  };
}

const groupify = (request: APIRequestContext, jwt: string) => ({
  post: async (path: string, data: unknown) => {
    const res = await request.post(`${API}${path}`, { headers: { Authorization: `Bearer ${jwt}` }, data });
    expect(res.ok(), `POST ${path}: ${res.status()}`).toBeTruthy();
    return res.json();
  },
  feed: async (groupId: string): Promise<Share[]> =>
    (await (await request.get(`${API}/shares/groups/${groupId}?limit=50`, { headers: { Authorization: `Bearer ${jwt}` } })).json()).shares,
});

async function openGroupify(page: Page, jwt: string, path: string) {
  await page.addInitScript((t) => {
    localStorage.setItem('groupify_token', t);
    localStorage.setItem('groupify_tour_completed', 'true');
  }, jwt);
  await page.goto(path);
}

/** A second Spotify Connect device, as if another app were playing. */
async function openSpeaker(page: Page, accessToken: string) {
  const origin = 'https://speaker.groupify.test/';
  await page.route(origin, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><script>
      window.onSpotifyWebPlaybackSDKReady = () => {
        window.speaker = new Spotify.Player({ name: ${JSON.stringify(SPEAKER)}, getOAuthToken: (cb) => cb(${JSON.stringify(accessToken)}) });
        window.speaker.connect();
      };
    </script><script src="https://sdk.scdn.co/spotify-player.js"></script>`,
  }));
  await page.goto(origin);
}

test.skip(TRACKS.length < 3, 'Set SMOKE_TRACK_IDS to three short Spotify track IDs');

test('real playback on Spotify', async ({ browser, request }) => {
  test.setTimeout(6 * 60_000);
  const jwt = await signIn(request);
  const spotify = spotifyApi(request, jwt);
  const app = groupify(request, jwt);
  let touchedPlayback = false;
  const contexts = [await browser.newContext(), await browser.newContext()];
  const ids = { web: '', speaker: '' };

  /**
   * What Spotify reports, as labels the public log can show: which of
   * TRACKS is playing (by index) and on which of our devices, never names.
   */
  const state = async () => {
    const now = await spotify.playback();
    if (!now) return { playing: false, track: 'none', device: 'none' };
    const index = TRACKS.findIndex((t) => t === now.item?.id || t === now.item?.linked_from?.id);
    const device = now.device.id === ids.web ? 'web' : now.device.id === ids.speaker ? 'speaker' : 'other';
    return { playing: now.is_playing, track: index === -1 ? 'other' : index, device };
  };

  // Diagnostics for a failed run: the player API's statuses, the app's
  // toasts and its Spotify errors. No tokens, names or device names.
  const diagnostics: string[] = [];
  const watch = (page: Page) => {
    page.on('response', (res) => {
      const path = new URL(res.url()).pathname;
      if (path.includes('/api/v1/player/') && !path.endsWith('/playback')) diagnostics.push(`${res.request().method()} ${path.replace(/^.*\/api\/v1/, '')} -> ${res.status()}`);
    });
    // Errors and warnings only: info lines carry track and group names.
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') diagnostics.push(`console.${msg.type()}: ${msg.text().slice(0, 200)}`);
    });
  };

  /**
   * The device a page registers. Spotify keeps closed players listed for a
   * while (an earlier run's, the owner's own Groupify tab), so it's the new
   * one with that name, not the first.
   */
  const devicesNamed = async (name: string) => new Set((await spotify.devices()).filter((d) => d.name === name).map((d) => d.id));
  const newDevice = async (name: string, known: Set<string>) => {
    let id = '';
    await expect.poll(async () => {
      id = [...await devicesNamed(name)].find((d) => !known.has(d)) ?? '';
      return id;
    }, { timeout: 45_000 }).not.toBe('');
    return id;
  };

  try {
    await test.step('stops before touching anything if the owner is listening', async () => {
      const now = await spotify.playback();
      if (now?.is_playing) {
        // No device name: the Actions log is public.
        throw new Error('Something is playing on this Spotify account. Stopped before touching playback; run again when nothing is playing.');
      }
    });

    // Newest share first in the playlist, so share in reverse: playlist = TRACKS.
    const { group } = await app.post('/groups', { name: `Playback smoke ${new Date().toISOString().slice(0, 16)}` });
    for (const id of [...TRACKS.slice(0, 3)].reverse()) {
      await app.post('/shares', { groupId: group._id, spotifyTrackId: id });
    }
    const shares = await app.feed(group._id);
    const share = (i: number) => shares.find((s) => s.spotifyTrackId === TRACKS[i])!;

    const page = await contexts[0].newPage();
    watch(page);
    const player = page.getByTestId('spotify-player');

    await test.step(`"${WEB_PLAYER}" joins the device list without taking over playback`, async () => {
      const before = await spotify.playback();
      const known = await devicesNamed(WEB_PLAYER);
      await openGroupify(page, jwt, `/groups/${group._id}`);
      ids.web = await newDevice(WEB_PLAYER, known);
      const after = await spotify.playback();
      expect(after?.device.id ?? null).toBe(before?.device.id ?? null);
    });

    await test.step('play: Spotify plays the share on this browser, and it advances', async () => {
      touchedPlayback = true;
      await page.getByRole('button', { name: `Play ${share(0).trackName}` }).click();
      await expect.poll(state, { timeout: 30_000 }).toEqual({ playing: true, track: 0, device: 'web' });
      const first = (await spotify.playback())!.progress_ms;
      await page.waitForTimeout(3000);
      expect((await spotify.playback())!.progress_ms).toBeGreaterThan(first + 1500);
    });

    await test.step('pause', async () => {
      await player.getByRole('button', { name: 'Pause', exact: true }).click();
      await expect.poll(state, { timeout: 15_000 }).toEqual({ playing: false, track: 0, device: 'web' });
    });

    await test.step('next plays the next share', async () => {
      await player.getByRole('button', { name: 'Next track', exact: true }).click();
      await expect.poll(state, { timeout: 30_000 }).toEqual({ playing: true, track: 1, device: 'web' });
    });

    await test.step('seek lands where the bar was clicked', async () => {
      const duration = (await spotify.playback())!.item!.duration_ms;
      const bar = (await player.locator('span[aria-label="Seek"]').boundingBox())!;
      await page.mouse.click(bar.x + bar.width * 0.5, bar.y + bar.height / 2);
      await expect.poll(async () => Math.abs((await spotify.playback())!.progress_ms - duration / 2), { timeout: 15_000 })
        .toBeLessThan(8000);
    });

    await test.step('a track that ends auto-advances and is marked as listened', async () => {
      const bar = (await player.locator('span[aria-label="Seek"]').boundingBox())!;
      await page.mouse.click(bar.x + bar.width * 0.99, bar.y + bar.height / 2);
      await expect.poll(state, { timeout: 45_000 }).toEqual({ playing: true, track: 2, device: 'web' });
      await expect.poll(async () => (await app.feed(group._id)).find((s) => s._id === share(1)._id)!.listeners.length, { timeout: 30_000 })
        .toBeGreaterThan(0);
      await player.getByRole('button', { name: 'Pause', exact: true }).click();
      await expect.poll(async () => (await state()).playing, { timeout: 15_000 }).toBe(false);
    });

    await test.step('opening Groupify while another device plays does not take it over', async () => {
      const speakerPage = await contexts[1].newPage();
      const knownSpeakers = await devicesNamed(SPEAKER);
      await openSpeaker(speakerPage, await spotify.accessToken());
      ids.speaker = await newDevice(SPEAKER, knownSpeakers);
      await spotify.play(ids.speaker, [`spotify:track:${TRACKS[0]}`]);
      await expect.poll(state, { timeout: 20_000 }).toEqual({ playing: true, track: 0, device: 'speaker' });

      // A fresh Groupify tab registers its own player.
      const second = await contexts[0].newPage();
      watch(second);
      const knownTabs = await devicesNamed(WEB_PLAYER);
      await openGroupify(second, jwt, '/');
      await newDevice(WEB_PLAYER, knownTabs);
      await page.waitForTimeout(5000);
      expect(await state()).toEqual({ playing: true, track: 0, device: 'speaker' });

      await spotify.pause();
      await second.close();
      await speakerPage.evaluate(() => (window as unknown as { speaker: { disconnect: () => void } }).speaker.disconnect());
    });

    await test.step(`signing out removes "${WEB_PLAYER}" from the device list`, async () => {
      await page.goto('/profile');
      await page.getByRole('button', { name: 'Sign Out' }).click();
      await expect.poll(async () => (await spotify.devices()).some((d) => d.id === ids.web), { timeout: 45_000 }).toBe(false);
    });
  } catch (error) {
    const toasts = await contexts[0].pages()[0]?.locator('[data-sonner-toast]').allTextContents().catch(() => []) ?? [];
    console.log(['Diagnostics:', `Spotify state: ${JSON.stringify(await state().catch(() => 'unavailable'))}`,
      ...toasts.map((t) => `toast: ${t}`), ...diagnostics].join('\n  '));
    throw error;
  } finally {
    // Leave the account as it was: nothing playing, no test devices.
    if (touchedPlayback) {
      const now = await spotify.playback().catch(() => null);
      if (now?.is_playing) await spotify.pause().catch(() => {});
    }
    for (const context of contexts) await context.close();
  }
});
