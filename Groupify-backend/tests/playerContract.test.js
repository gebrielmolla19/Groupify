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

    // #123: Spotify can reject a token we still think is valid (revoked
    // early, clock skew). Refresh once and retry once.
    describe('when Spotify rejects a token we think is valid (401)', () => {
      const refreshed = () => axios.post.mockResolvedValueOnce({ data: { access_token: 'fresh-token', expires_in: 3600 } });

      it('refreshes the token, saves it, and retries once with it', async () => {
        refreshed();
        axios.put
          .mockRejectedValueOnce(spotifyError(401, 'The access token expired'))
          .mockResolvedValueOnce({ data: {} });

        const res = await play('web1');

        expect(res.status).toBe(200);
        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(axios.put.mock.calls.map(([, , config]) => config.headers.Authorization)).toEqual(['Bearer access-token', 'Bearer fresh-token']);
        expect(targetedDevices()).toEqual(['web1', 'web1']);
        const saved = await User.findById(user._id).select('+spotifyAccessToken');
        expect(saved.spotifyAccessToken).toBe('fresh-token');
      });

      it('passes a second 401 through without refreshing again', async () => {
        refreshed();
        axios.put
          .mockRejectedValueOnce(spotifyError(401))
          .mockRejectedValueOnce(spotifyError(401));

        const res = await play('web1');

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({ success: false, message: 'Invalid or expired Spotify token' });
        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(axios.put).toHaveBeenCalledTimes(2);
      });

      it('asks the user to sign in again when Spotify rejects the refresh token too', async () => {
        const invalidGrant = new Error('Request failed with status code 400');
        invalidGrant.response = { status: 400, data: { error: 'invalid_grant', error_description: 'Refresh token revoked' } };
        axios.post.mockRejectedValueOnce(invalidGrant);
        axios.put.mockRejectedValueOnce(spotifyError(401));

        const res = await play('web1');

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('SPOTIFY_REAUTH_REQUIRED');
        expect(axios.put).toHaveBeenCalledTimes(1);
      });

      it('reports the original 401 and keeps the stored tokens when the refresh fails for another reason', async () => {
        axios.post.mockRejectedValueOnce(spotifyError(503, 'Service unavailable'));
        axios.put.mockRejectedValueOnce(spotifyError(401));

        const res = await play('web1');

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({ success: false, message: 'Invalid or expired Spotify token' });
        expect(res.body.code).toBeUndefined();
        expect(axios.put).toHaveBeenCalledTimes(1);
        const saved = await User.findById(user._id).select('+spotifyAccessToken +spotifyRefreshToken');
        expect(saved.spotifyAccessToken).toBe('access-token');
        expect(saved.spotifyRefreshToken).toBe('refresh-token');
      });

      it.each([
        // (Not POST /next: the token refresh is an axios.post too.)
        ['PUT /pause', 'put', () => request(app).put('/api/v1/player/pause').set('Authorization', auth).send({})],
        ['GET /devices', 'get', () => request(app).get('/api/v1/player/devices').set('Authorization', auth)],
        ['GET /playback', 'get', () => request(app).get('/api/v1/player/playback').set('Authorization', auth)],
      ])('%s refreshes and retries too', async (_route, method, send) => {
        refreshed();
        axios[method]
          .mockRejectedValueOnce(spotifyError(401))
          .mockResolvedValueOnce({ data: { devices: [] } });

        const res = await send();

        expect(res.status).toBe(200);
        expect(axios[method].mock.calls.at(-1)[1 + (method === 'get' ? 0 : 1)].headers.Authorization).toBe('Bearer fresh-token');
      });
    });

    it('passes Spotify\'s 403 through as Premium required', async () => {
      axios.put.mockRejectedValueOnce(spotifyError(403, 'Player command failed: Premium required'));

      const res = await play('web1');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Premium/);
    });

    it('passes Spotify\'s 429 through with the wait the client can read (invariant 7, #121)', async () => {
      axios.put.mockRejectedValueOnce(spotifyError(429, 'API rate limit exceeded', { 'retry-after': '7' }));

      const res = await play('web1');

      expect(res.status).toBe(429);
      expect(res.body).toMatchObject({ success: false, message: 'Spotify rate limit exceeded. Retry after 7 seconds.', retryAfter: 7 });
      expect(res.headers['retry-after']).toBe('7');
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

  describe('reading state', () => {
    it('GET /devices returns Spotify\'s device list', async () => {
      axios.get.mockResolvedValueOnce(devices('phone', 'web1'));

      const res = await request(app).get('/api/v1/player/devices').set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(axios.get.mock.calls[0][0]).toBe(`${SPOTIFY}/me/player/devices`);
      expect(res.body.devices.map((d) => d.id)).toEqual(['phone', 'web1']);
    });

    it('GET /playback returns what Spotify reports is playing', async () => {
      axios.get.mockResolvedValueOnce({ data: { is_playing: true, item: { id: 't1' }, device: { id: 'phone' } } });

      const res = await request(app).get('/api/v1/player/playback').set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(axios.get.mock.calls[0][0]).toBe(`${SPOTIFY}/me/player`);
      expect(res.body.playback).toMatchObject({ is_playing: true, item: { id: 't1' } });
    });

    it('GET /playback reports nothing playing when Spotify has no active device', async () => {
      axios.get.mockRejectedValueOnce(spotifyError(404));

      const res = await request(app).get('/api/v1/player/playback').set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.playback).toBeNull();
    });
  });

  // #121: every player route reports Spotify's rate limit the same way, so
  // the client can wait the time Spotify asked for before polling again.
  describe('Spotify rate limit (429)', () => {
    const routes = [
      ['GET /playback', 'get', () => request(app).get('/api/v1/player/playback').set('Authorization', auth)],
      ['GET /devices', 'get', () => request(app).get('/api/v1/player/devices').set('Authorization', auth)],
      ['PUT /transfer', 'put', () => request(app).put('/api/v1/player/transfer').set('Authorization', auth).send({ device_id: 'spk' })],
      ['PUT /pause', 'put', () => request(app).put('/api/v1/player/pause').set('Authorization', auth).send({})],
      ['PUT /resume', 'put', () => request(app).put('/api/v1/player/resume').set('Authorization', auth).send({})],
      ['POST /next', 'post', () => request(app).post('/api/v1/player/next').set('Authorization', auth).send({})],
      ['POST /previous', 'post', () => request(app).post('/api/v1/player/previous').set('Authorization', auth).send({})],
      ['PUT /seek', 'put', () => request(app).put('/api/v1/player/seek').set('Authorization', auth).send({ position_ms: 0 })],
    ];

    it.each(routes)('%s returns 429 with retryAfter and a Retry-After header', async (_route, method, send) => {
      axios[method].mockRejectedValueOnce(spotifyError(429, 'API rate limit exceeded', { 'retry-after': '12' }));

      const res = await send();

      expect(res.status).toBe(429);
      expect(res.body).toMatchObject({ success: false, retryAfter: 12 });
      expect(res.headers['retry-after']).toBe('12');
      expect(axios[method]).toHaveBeenCalledTimes(1);
    });

    it('leaves retryAfter out when Spotify gives no usable wait', async () => {
      axios.get.mockRejectedValueOnce(spotifyError(429, 'API rate limit exceeded', { 'retry-after': 'soon' }));

      const res = await request(app).get('/api/v1/player/playback').set('Authorization', auth);

      expect(res.status).toBe(429);
      expect(res.body.retryAfter).toBeUndefined();
      expect(res.headers['retry-after']).toBeUndefined();
    });
  });

  it.each([
    'get /devices', 'get /playback', 'put /transfer', 'put /play', 'put /pause',
    'put /resume', 'post /next', 'post /previous', 'put /seek',
  ])('%s needs a signed-in user', async (route) => {
    const [method, path] = route.split(' ');

    const res = await request(app)[method](`/api/v1/player${path}`).send({ device_id: 'web1', track_uri: 'spotify:track:t1', position_ms: 0 });

    expect(res.status).toBe(401);
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.put).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });
});
