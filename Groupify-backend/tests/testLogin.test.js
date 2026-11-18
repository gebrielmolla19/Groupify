// GET /auth/test-login: signs in a seeded user without Spotify's sign-in
// page, for e2e runs. With SPOTIFY_TEST_REFRESH_TOKEN set (the real-Spotify
// smoke workflow, #76 tier 3), that user gets real Spotify tokens.
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

const login = () => request(app).get('/api/v1/auth/test-login');
const codeFrom = (res) => new URL(res.headers.location).searchParams.get('code');

describe('GET /api/v1/auth/test-login', () => {
  const KEYS = ['NODE_ENV', 'E2E_TEST_LOGIN', 'SPOTIFY_TEST_REFRESH_TOKEN'];
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('is not found outside tests unless E2E_TEST_LOGIN is on', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.E2E_TEST_LOGIN;

    const res = await login();

    expect(res.status).toBe(404);
  });

  it('signs in the seeded user with a one-time code', async () => {
    const res = await login();

    expect(res.status).toBe(302);
    const exchange = await request(app).post('/api/v1/auth/exchange-code').send({ code: codeFrom(res) });
    expect(exchange.status).toBe(200);
    expect(exchange.body.token).toEqual(expect.any(String));
  });

  it('without a real refresh token, the user keeps placeholder tokens', async () => {
    delete process.env.SPOTIFY_TEST_REFRESH_TOKEN;

    await login();

    const user = await User.findOne({ spotifyId: 'e2e-test-user' });
    expect(user.spotifyRefreshToken).toBe('e2e-test-refresh');
  });

  it('with SPOTIFY_TEST_REFRESH_TOKEN, stores it and forces a refresh on the first Spotify call', async () => {
    process.env.SPOTIFY_TEST_REFRESH_TOKEN = 'fake-refresh-token';

    await login();

    const user = await User.findOne({ spotifyId: 'e2e-test-user' });
    expect(user.spotifyRefreshToken).toBe('fake-refresh-token');
    expect(user.tokenExpiresAt.getTime()).toBeLessThan(Date.now());
  });

  it('keeps a refreshed token on later logins in the same run', async () => {
    process.env.SPOTIFY_TEST_REFRESH_TOKEN = 'fake-refresh-token';
    await login();
    // The backend has since refreshed: a new access token, maybe a rotated refresh token.
    const later = new Date(Date.now() + 3600000);
    await User.updateOne({ spotifyId: 'e2e-test-user' }, { spotifyAccessToken: 'fresh', spotifyRefreshToken: 'rotated', tokenExpiresAt: later });

    await login();

    const user = await User.findOne({ spotifyId: 'e2e-test-user' });
    expect(user.spotifyRefreshToken).toBe('rotated');
    expect(user.spotifyAccessToken).toBe('fresh');
  });
});
