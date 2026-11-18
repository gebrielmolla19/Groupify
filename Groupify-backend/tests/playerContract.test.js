// #76 tier 2: the player API's contract with Spotify, end to end through the
// routes. Requests go through the real route, controller, TokenManager and
// SpotifyService; only axios (Spotify's edge) is mocked. These pin down what
// Groupify asks Spotify to do and what the client gets back when Spotify
// says no. See the groupify-playback skill for the invariants.
const request = require('supertest');
const axios = require('axios');
const app = require('../src/app');
const User = require('../src/models/User');
const { generateToken } = require('../src/middleware/authMiddleware');
const { SPOTIFY_SCOPES } = require('../src/config/spotifyScopes');

jest.mock('axios');

const SPOTIFY = 'https://api.spotify.com/v1';

/** An axios error as Spotify's API returns it. */
const spotifyError = (status, message = 'Error', headers = {}) => {
  const err = new Error(`Request failed with status code ${status}`);
  err.response = { status, data: { error: { status, message } }, headers };
  return err;
};

const devices = (...ids) => ({
  data: { devices: ids.map((id) => ({ id, name: id === 'other-tab' ? 'Groupify Web Player' : id, is_active: id === 'phone' })) },
});

describe('Player API contract with Spotify', () => {
  let user;
  let auth;

  const createUser = (overrides = {}) => User.create({
    spotifyId: 'contract-user',
    displayName: 'Sample User',
    email: 'sample@example.com',
    spotifyAccessToken: 'access-token',
    spotifyRefreshToken: 'refresh-token',
    tokenExpiresAt: new Date(Date.now() + 3600000),
    spotifyScopes: SPOTIFY_SCOPES.join(' '),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    user = await createUser();
    auth = `Bearer ${generateToken(user._id)}`;
  });

  const play = (deviceId = 'web1', trackUri = 'spotify:track:t1') =>
    request(app).put('/api/v1/player/play').set('Authorization', auth).send({ device_id: deviceId, track_uri: trackUri });

  /** Every device Groupify asked Spotify to play on or transfer to. */
  const targetedDevices = () => axios.put.mock.calls.flatMap(([url, body]) => {
    if (url.startsWith(`${SPOTIFY}/me/player/play`)) return [new URL(url).searchParams.get('device_id')];
    if (url === `${SPOTIFY}/me/player`) return body.device_ids;
    return [];
  });

  describe('PUT /player/play', () => {
    it('plays on the requested device with the requested track and the user\'s token', async () => {
      axios.put.mockResolvedValueOnce({ data: {} });

      const res = await play('web1', 'spotify:track:t1');

      expect(res.status).toBe(200);
      expect(axios.put).toHaveBeenCalledTimes(1);
      const [url, body, config] = axios.put.mock.calls[0];
      expect(url).toBe(`${SPOTIFY}/me/player/play?device_id=web1`);
      expect(body).toEqual({ uris: ['spotify:track:t1'] });
      expect(config.headers.Authorization).toBe('Bearer access-token');
    });

    it('on a 404, retries on the requested device only, even when other devices are listed and one is active (invariant 1)', async () => {
      axios.put
        .mockRejectedValueOnce(spotifyError(404, 'Device not found')) // play
        .mockResolvedValueOnce({ data: {} }) // transfer
        .mockResolvedValueOnce({ data: {} }); // play again
      axios.get.mockResolvedValueOnce(devices('phone', 'other-tab', 'web1'));

      const res = await play('web1');

      expect(res.status).toBe(200);
      expect(targetedDevices()).toEqual(['web1', 'web1', 'web1']);
    });

    it('on a 404 for a device Spotify no longer lists, moves nothing and returns the 404 (invariant 1)', async () => {
      axios.put.mockRejectedValueOnce(spotifyError(404, 'Device not found'));
      axios.get.mockResolvedValueOnce(devices('phone', 'other-tab'));

      const res = await play('web1');

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false, message: expect.stringContaining('Device not found') });
      expect(targetedDevices()).toEqual(['web1']);
    });

    it('on a 404 when the device list can\'t be read, moves nothing and returns the 404', async () => {
      axios.put.mockRejectedValueOnce(spotifyError(404));
      axios.get.mockRejectedValue(spotifyError(500));

      const res = await play('web1');

      expect(res.status).toBe(404);
      expect(targetedDevices()).toEqual(['web1']);
    });

    it('refreshes an expired token before calling Spotify, and saves it', async () => {
      await User.updateOne({ _id: user._id }, { tokenExpiresAt: new Date(Date.now() - 1000) });
      axios.post.mockResolvedValueOnce({ data: { access_token: 'fresh-token', expires_in: 3600 } });
      axios.put.mockResolvedValueOnce({ data: {} });

      const res = await play('web1');

      expect(res.status).toBe(200);
      expect(axios.post.mock.calls[0][0]).toBe('https://accounts.spotify.com/api/token');
      expect(axios.put.mock.calls[0][2].headers.Authorization).toBe('Bearer fresh-token');
      const saved = await User.findById(user._id).select('+spotifyAccessToken');
      expect(saved.spotifyAccessToken).toBe('fresh-token');
      expect(saved.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('passes Spotify\'s 401 through as a 401, without retrying', async () => {
      axios.put.mockRejectedValueOnce(spotifyError(401, 'The access token expired'));

      const res = await play('web1');

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, message: 'Invalid or expired Spotify token' });
      expect(axios.put).toHaveBeenCalledTimes(1);
    });

    it('passes Spotify\'s 403 through as Premium required', async () => {
      axios.put.mockRejectedValueOnce(spotifyError(403, 'Player command failed: Premium required'));

      const res = await play('web1');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Premium/);
    });

    it('passes Spotify\'s 429 through with the Retry-After wait in the message (invariant 7)', async () => {
      axios.put.mockRejectedValueOnce(spotifyError(429, 'API rate limit exceeded', { 'retry-after': '7' }));

      const res = await play('web1');

      expect(res.status).toBe(429);
      expect(res.body.message).toBe('Spotify rate limit exceeded. Retry after 7 seconds.');
      // One request: Groupify doesn't hammer Spotify while it's limiting us.
      expect(axios.put).toHaveBeenCalledTimes(1);
    });

    it('rejects a bad track URI without calling Spotify', async () => {
      const res = await play('web1', 'spotify:album:a1');

      expect(res.status).toBe(400);
      expect(axios.put).not.toHaveBeenCalled();
    });
  });

  describe('PUT /player/transfer', () => {
    it('transfers to exactly the chosen device', async () => {
      axios.put.mockResolvedValueOnce({ data: {} });

      const res = await request(app).put('/api/v1/player/transfer').set('Authorization', auth).send({ device_id: 'spk', play: true });

      expect(res.status).toBe(200);
      expect(axios.put.mock.calls[0][0]).toBe(`${SPOTIFY}/me/player`);
      expect(axios.put.mock.calls[0][1]).toEqual({ device_ids: ['spk'], play: true });
    });

    it('passes Spotify\'s 403 through', async () => {
      axios.put.mockRejectedValueOnce(spotifyError(403));

      const res = await request(app).put('/api/v1/player/transfer').set('Authorization', auth).send({ device_id: 'spk' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Premium/);
    });
  });

  describe('remote controls', () => {
    const cases = [
      { route: 'PUT /pause', spotify: ['put', '/me/player/pause'] },
      { route: 'PUT /resume', spotify: ['put', '/me/player/play'] },
      { route: 'POST /next', spotify: ['post', '/me/player/next'] },
      { route: 'POST /previous', spotify: ['post', '/me/player/previous'] },
    ];
    const send = (route, body) => {
      const [method, path] = route.split(' ');
      return request(app)[method.toLowerCase()](`/api/v1/player${path}`).set('Authorization', auth).send(body);
    };

    it.each(cases)('$route targets the device the client named', async ({ route, spotify: [method, path] }) => {
      axios[method].mockResolvedValueOnce({ data: {} });

      const res = await send(route, { device_id: 'phone1' });

      expect(res.status).toBe(200);
      expect(axios[method]).toHaveBeenCalledTimes(1);
      expect(axios[method].mock.calls[0][0]).toBe(`${SPOTIFY}${path}?device_id=phone1`);
    });

    it.each(cases)('$route without a device targets Spotify\'s active device', async ({ route, spotify: [method, path] }) => {
      axios[method].mockResolvedValueOnce({ data: {} });

      await send(route, {});

      expect(axios[method].mock.calls[0][0]).toBe(`${SPOTIFY}${path}`);
    });

    it.each(cases)('$route passes Spotify\'s 404 through', async ({ route, spotify: [method] }) => {
      axios[method].mockRejectedValueOnce(spotifyError(404, 'Device not found'));

      const res = await send(route, { device_id: 'phone1' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toEqual(expect.any(String));
    });

    it('PUT /seek sends the position and device', async () => {
      axios.put.mockResolvedValueOnce({ data: {} });

      const res = await send('PUT /seek', { position_ms: 107000, device_id: 'phone1' });

      expect(res.status).toBe(200);
      expect(axios.put.mock.calls[0][0]).toBe(`${SPOTIFY}/me/player/seek?position_ms=107000&device_id=phone1`);
    });

    it('PUT /seek rejects a negative position without calling Spotify', async () => {
      const res = await send('PUT /seek', { position_ms: -1 });

      expect(res.status).toBe(400);
      expect(axios.put).not.toHaveBeenCalled();
    });
  });

  it('every player route needs a signed-in user', async () => {
    const res = await request(app).put('/api/v1/player/play').send({ device_id: 'web1', track_uri: 'spotify:track:t1' });

    expect(res.status).toBe(401);
    expect(axios.put).not.toHaveBeenCalled();
  });
});
