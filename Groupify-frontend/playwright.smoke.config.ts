import { defineConfig } from '@playwright/test';

/**
 * Real-Spotify smoke tests (#76 tier 3), run on demand by the
 * playback-smoke workflow against the owner's Premium account. They need a
 * running backend with E2E_TEST_LOGIN=true and SPOTIFY_TEST_REFRESH_TOKEN,
 * so they live outside `e2e/` and the normal Playwright run.
 * See CONTRIBUTING §4.
 */
export default defineConfig({
  testDir: './e2e-smoke',
  fullyParallel: false,
  workers: 1,
  // A retry would play music again; a failed run is rerun by hand.
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    // The repo is public, and so are its Actions logs and artifacts. A trace
    // records request headers (the Spotify access token), so CI keeps none.
    trace: process.env.CI ? 'off' : 'retain-on-failure',
    screenshot: process.env.CI ? 'off' : 'only-on-failure',
    // Real Chrome: Playwright's bundled Chromium has no Widevine headless,
    // and the Spotify SDK needs it (spike in #76).
    channel: 'chrome',
    launchOptions: {
      args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
      // On macOS Chrome downloads Widevine as a component.
      ignoreDefaultArgs: ['--disable-component-update'],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
