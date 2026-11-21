// A signed-in group feed with a fake Spotify Web Playback SDK and a stubbed
// backend, for the playback e2e spec (#76, tier 1). No Spotify, no backend.
//
// The fake SDK is served in place of sdk.scdn.co. It records every call the
// app makes to the player, and the page's fetch is wrapped to record every
// API request, both into one ordered log (`window.__log`), so a test can
// assert order: for example that activateElement() runs before
// PUT /player/play. Tests drive "Spotify" through `window.__fakeSpotify`.
import { expect, type Page } from '@playwright/test';

const me = { _id: 'u1', spotifyId: 's1', displayName: 'Sample User', email: null, profileImage: null, groups: ['g1'], isActive: true };
const friend = { _id: 'u2', displayName: 'Test Friend', profileImage: null };
const group = { _id: 'g1', name: 'Sample Group', description: '', createdBy: me, members: [me, friend], inviteCode: 'ABC123', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

// Newest first, so the playlist ("recently added") is t1, t2, t3.
export const shares = [1, 2, 3].map((i) => ({
  _id: `sh${i}`, group: 'g1', sharedBy: friend, spotifyTrackId: `t${i}`,
  trackName: `Sample Track ${i}`, artistName: 'Sample Artist', albumName: 'Sample Album',
  trackImage: null, trackPreviewUrl: null, trackExternalUrl: `https://open.spotify.com/track/t${i}`, durationMs: 200000,
  genres: [], listeners: [], listenCount: 0, likes: [], likeCount: 0,
  createdAt: `2026-01-0${4 - i}T00:00:00.000Z`, updatedAt: '2026-01-01T00:00:00.000Z',
}));

export const devices = [
  { id: 'web1', name: 'Groupify Web Player', type: 'Computer', is_active: false, is_private_session: false, is_restricted: false, volume_percent: 100 },
  { id: 'spk', name: 'Living Room Speaker', type: 'Speaker', is_active: false, is_private_session: false, is_restricted: false, volume_percent: 50 },
];

// Something playing in the Spotify app on another device.
export const remotePlayback = {
  device: { id: 'phone1', name: 'Pixel', type: 'Smartphone', is_active: true, is_private_session: false, is_restricted: false, volume_percent: 80 },
  item: { id: 'r1', name: 'Remote Song', artists: [{ name: 'Remote Artist', id: 'a1' }], album: { name: 'Remote Album', images: [] }, duration_ms: 300000, external_urls: { spotify: 'https://open.spotify.com/track/r1' } },
  is_playing: true, progress_ms: 1000, timestamp: 0,
};

// Runs in the page instead of https://sdk.scdn.co/spotify-player.js.
export const FAKE_SDK = `(() => {
  const log = window.__log;
  const cfg = window.__fakeSpotifyConfig || {};
  const listeners = {};
  let state = null;
  const emit = (event, payload) => (listeners[event] || []).forEach((fn) => fn(payload));
  const setState = (next) => { state = next; emit('player_state_changed', next); };
  const call = (name, change) => { log.push('sdk:' + name); if (state && change) setState({ ...state, ...change(state) }); return Promise.resolve(); };
  class Player {
    constructor(options) { this.options = options; log.push('sdk:new ' + options.name); }
    addListener(event, fn) { (listeners[event] = listeners[event] || []).push(fn); return true; }
    removeListener(event) { delete listeners[event]; return true; }
    async connect() {
      log.push('sdk:connect');
      await new Promise((resolve) => this.options.getOAuthToken(resolve));
      setTimeout(() => cfg.initError
        ? emit('initialization_error', { message: 'Failed to initialize player' })
        : emit('ready', { device_id: 'web1' }), 50);
      return true;
    }
    disconnect() { log.push('sdk:disconnect'); }
    activateElement() { return call('activateElement'); }
    togglePlay() { return call('togglePlay', (s) => ({ paused: !s.paused })); }
    pause() { return call('pause', () => ({ paused: true })); }
    resume() { return call('resume', () => ({ paused: false })); }
    nextTrack() { return call('nextTrack'); }
    previousTrack() { return call('previousTrack'); }
    seek(ms) { return call('seek ' + ms, () => ({ position: ms })); }
    getCurrentState() { return Promise.resolve(state); }
  }
  window.__fakeSpotify = { emit, setState, getState: () => state };
  window.Spotify = { Player };
  if (window.onSpotifyWebPlaybackSDKReady) window.onSpotifyWebPlaybackSDKReady();
})();`;

/** Spotify's player state for one of the sample shares (or any track id). */
export const stateFor = (trackId: string, change: { paused?: boolean; position?: number; duration?: number } = {}) => ({
  paused: false, position: 0, duration: 200000, ...change,
  track_window: {
    current_track: {
      uri: `spotify:track:${trackId}`, id: trackId, name: shares.find((s) => s.spotifyTrackId === trackId)?.trackName ?? trackId,
      artists: [{ name: 'Sample Artist', uri: 'spotify:artist:a' }], album: { name: 'Sample Album', uri: 'spotify:album:b', images: [] },
    },
  },
});

export interface FakeSpotifyOptions {
  /** The SDK fires initialization_error instead of ready (a browser without EME). */
  initError?: boolean;
  /** What GET /player/playback reports: nothing, or the Spotify app playing elsewhere. */
  remote?: typeof remotePlayback | null;
  /** Statuses for successive PUT /player/play requests; 200 once they run out. */
  playStatuses?: number[];
  /** The first GET /player/playback answers 429 with this retryAfter (seconds), as the backend does for Spotify's rate limit. */
  playbackRateLimit?: number;
  viewport?: { width: number; height: number };
  /** The screen to open: the group feed (default) or, for example, its playlist. */
  path?: '/groups/g1' | '/groups/g1/playlist';
}

export async function openPlayer(page: Page, opts: FakeSpotifyOptions = {}) {
  const token = 'x.' + Buffer.from(JSON.stringify({ id: 'u1', exp: 4102444800 })).toString('base64url') + '.y';
  if (opts.viewport) await page.setViewportSize(opts.viewport);
  await page.addInitScript(([t, initError]) => {
    localStorage.setItem('groupify_token', t as string);
    localStorage.setItem('groupify-theme', 'dark');
    localStorage.setItem('groupify_tour_completed', 'true');
    const w = window as unknown as { __log: string[]; __fakeSpotifyConfig: object };
    w.__log = [];
    w.__fakeSpotifyConfig = { initError };
    // Record API calls in the same log as the SDK calls, in order.
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
      if (url.pathname.startsWith('/api/v1/')) {
        const body = typeof init?.body === 'string' ? ' ' + init.body : '';
        w.__log.push(`api:${init?.method ?? 'GET'} ${url.pathname.slice('/api/v1'.length)}${body}`);
      }
      return realFetch(input, init);
    };
  }, [token, !!opts.initError] as const);

  await page.route('https://sdk.scdn.co/spotify-player.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: FAKE_SDK }));

  const playStatuses = [...(opts.playStatuses ?? [])];
  let playbackRateLimit = opts.playbackRateLimit;
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, '');
    const method = req.method();
    let json: unknown = { success: true, groups: [], invites: [], notifications: [] };

    if (path === '/player/play') {
      const status = playStatuses.shift() ?? 200;
      if (status !== 200) {
        return route.fulfill({ status, json: { success: false, message: status === 404 ? 'Device not found' : `HTTP ${status}` } });
      }
      const { track_uri } = req.postDataJSON() as { track_uri: string };
      await route.fulfill({ json: { success: true, message: 'Playing', data: {} } });
      // Spotify starts the track on the SDK device.
      await page.evaluate((s) => (window as unknown as { __fakeSpotify: { setState: (x: unknown) => void } }).__fakeSpotify.setState(s),
        stateFor(track_uri.replace('spotify:track:', '')));
      return;
    }
    if (path === '/auth/spotify-token') json = { success: true, accessToken: 'fake-access-token' };
    else if (path === '/auth/me') json = { success: true, user: me };
    else if (path === '/player/devices') json = { success: true, devices };
    else if (path === '/player/playback' && playbackRateLimit !== undefined) {
      const retryAfter = playbackRateLimit;
      playbackRateLimit = undefined;
      return route.fulfill({ status: 429, headers: { 'Retry-After': String(retryAfter) }, json: { success: false, message: `Spotify rate limit exceeded. Retry after ${retryAfter} seconds.`, retryAfter } });
    }
    else if (path === '/player/playback') json = { success: true, playback: opts.remote ?? null };
    else if (path.startsWith('/player/')) json = { success: true, message: 'OK' };
    else if (path === '/groups') json = { success: true, groups: [group] };
    else if (path === '/groups/g1') json = { success: true, group };
    else if (path === '/groups/g1/invites') json = { success: true, invites: [] };
    else if (path.startsWith('/shares/groups/g1')) json = { success: true, shares, total: shares.length, limit: 100, offset: 0 };
    else if (path === '/shares/unheard') json = { success: true, shares, total: shares.length, newThisWeek: 0, byGroup: { g1: shares.length }, oldestAt: shares[2].createdAt };
    else if (method === 'POST' && /^\/shares\/sh\d\/listen$/.test(path)) {
      const s = shares.find((x) => x._id === path.split('/')[2])!;
      json = { success: true, share: { ...s, listeners: [{ user: me, listenedAt: new Date().toISOString(), timeToListen: 1 }], listenCount: 1 } };
    }
    return route.fulfill({ json });
  });

  // Sign-in can settle on the dashboard first; go to the screen until it sticks.
  // Both screens label track 1's play button "Play Sample Track 1…".
  const path = opts.path ?? '/groups/g1';
  await expect(async () => {
    if (new URL(page.url()).pathname !== path) await page.goto(path);
    await expect(page.getByRole('button', { name: 'Play Sample Track 1' })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
}

/** The ordered log of SDK calls (`sdk:…`) and API requests (`api:METHOD /path body`). */
export const readLog = (page: Page) => page.evaluate(() => (window as unknown as { __log: string[] }).__log.slice());

/** Drive the fake Spotify from the test. */
export const spotify = {
  emit: (page: Page, event: string, payload: unknown) =>
    page.evaluate(([e, p]) => (window as unknown as { __fakeSpotify: { emit: (e: string, p: unknown) => void } }).__fakeSpotify.emit(e as string, p), [event, payload] as const),
  setState: (page: Page, state: unknown) =>
    page.evaluate((s) => (window as unknown as { __fakeSpotify: { setState: (s: unknown) => void } }).__fakeSpotify.setState(s), state),
};

/** Waits until the SDK device is registered (the feed's play buttons need it). */
export async function waitForDevice(page: Page) {
  await expect(page.getByRole('button', { name: 'Play Sample Track 1' })).toBeEnabled();
  await expect.poll(() => readLog(page)).toContain('sdk:connect');
  await expect(page.getByTestId('spotify-player').getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
}
