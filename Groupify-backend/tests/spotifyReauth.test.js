const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { createUserAndToken } = require('./helpers');
const { createSpotifyReauthError, SPOTIFY_REAUTH_REQUIRED } = require('../src/utils/spotifyReauth');

jest.mock('../src/services/spotifyService', () => ({
  getAvailableDevices: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

const SpotifyService = require('../src/services/spotifyService');

// Spotify refresh tokens expire six months after the user's original
// authorisation; the token endpoint then answers 400 invalid_grant (#86).
describe('Expired Spotify refresh token', () => {
  let user;
  let token;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ user, token } = await createUserAndToken({
      // Access token already expired, so the next Spotify call refreshes it.
      tokenExpiresAt: new Date(Date.now() - 60 * 1000),
    }));
  });

  const expectReauthResponse = (res) => {
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(SPOTIFY_REAUTH_REQUIRED);
  };

  it('answers a player request with "Spotify sign-in required" and clears the stored tokens', async () => {
    SpotifyService.refreshAccessToken.mockRejectedValueOnce(createSpotifyReauthError());

    const res = await request(app)
      .get('/api/v1/player/devices')
      .set('Authorization', `Bearer ${token}`);

    expectReauthResponse(res);
    expect(SpotifyService.getAvailableDevices).not.toHaveBeenCalled();

    const stored = await User.findById(user._id).lean();
    expect(stored.spotifyRefreshToken).toBeUndefined();
    expect(stored.spotifyAccessToken).toBeUndefined();
  });

  it('does not ask Spotify again once the tokens are cleared', async () => {
    SpotifyService.refreshAccessToken.mockRejectedValueOnce(createSpotifyReauthError());

    await request(app).get('/api/v1/player/devices').set('Authorization', `Bearer ${token}`);
    const second = await request(app).get('/api/v1/player/devices').set('Authorization', `Bearer ${token}`);

    expectReauthResponse(second);
    expect(SpotifyService.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('answers the Web Playback SDK token request with "Spotify sign-in required"', async () => {
    SpotifyService.refreshAccessToken.mockRejectedValueOnce(createSpotifyReauthError());

    const res = await request(app)
      .get('/api/v1/auth/spotify-token')
      .set('Authorization', `Bearer ${token}`);

    expectReauthResponse(res);
  });

  it('answers the explicit refresh endpoint with "Spotify sign-in required"', async () => {
    SpotifyService.refreshAccessToken.mockRejectedValueOnce(createSpotifyReauthError());

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${token}`);

    expectReauthResponse(res);
    const stored = await User.findById(user._id).lean();
    expect(stored.spotifyRefreshToken).toBeUndefined();
  });

  it('refuses to renew the JWT once the Spotify tokens are cleared', async () => {
    SpotifyService.refreshAccessToken.mockRejectedValueOnce(createSpotifyReauthError());
    await request(app).get('/api/v1/player/devices').set('Authorization', `Bearer ${token}`);

    const res = await request(app).post('/api/v1/auth/refresh-jwt').send({ token });

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe(SPOTIFY_REAUTH_REQUIRED);
  });

  it('keeps the stored tokens when the refresh fails for another reason', async () => {
    SpotifyService.refreshAccessToken.mockRejectedValueOnce(new Error('Failed to refresh access token: socket hang up'));

    const res = await request(app)
      .get('/api/v1/player/devices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(500);
    expect(res.body.code).toBeUndefined();
    const stored = await User.findById(user._id).lean();
    expect(stored.spotifyRefreshToken).toBe('refresh-token');
  });

  it('still refreshes normally when Spotify accepts the refresh token', async () => {
    SpotifyService.refreshAccessToken.mockResolvedValueOnce({ accessToken: 'new-access', expiresIn: 3600, refreshToken: 'refresh-token' });
    SpotifyService.getAvailableDevices.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/v1/player/devices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(SpotifyService.getAvailableDevices).toHaveBeenCalledWith('new-access');
  });
});
