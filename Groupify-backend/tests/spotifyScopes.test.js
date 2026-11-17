const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { createUserAndToken } = require('./helpers');
const { SPOTIFY_SCOPES } = require('../src/config/spotifyScopes');
const { SPOTIFY_REAUTH_REQUIRED, SPOTIFY_NEW_SCOPES_MESSAGE } = require('../src/utils/spotifyReauth');

jest.mock('../src/services/spotifyService', () => ({
  exchangeCodeForToken: jest.fn(),
  getUserProfile: jest.fn(),
  getAvailableDevices: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

const SpotifyService = require('../src/services/spotifyService');
const ALL_SCOPES = SPOTIFY_SCOPES.join(' ');

// Following a playlist moved to PUT /me/library in February 2026, which needs
// scopes users who signed in earlier never granted (#87). Refreshing can't add
// scopes, so those users are sent through Spotify sign-in once.
describe('Spotify scopes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks for the library, follow and public-playlist scopes at sign-in', async () => {
    const res = await request(app).get('/api/v1/auth/login');
    const scope = new URL(res.header.location).searchParams.get('scope').split(' ');
    expect(scope).toEqual(expect.arrayContaining(['user-library-modify', 'user-follow-modify', 'playlist-modify-public']));
  });

  it('stores the scopes Spotify granted at sign-in', async () => {
    SpotifyService.exchangeCodeForToken.mockResolvedValueOnce({
      accessToken: 'a', refreshToken: 'r', expiresIn: 3600, scope: ALL_SCOPES,
    });
    SpotifyService.getUserProfile.mockResolvedValueOnce({ id: 'scoped-user', display_name: 'Sample User', images: [] });

    const res = await request(app).get('/api/v1/auth/callback?code=c&state=app%3A0');

    expect(res.statusCode).toBe(302);
    const stored = await User.findOne({ spotifyId: 'scoped-user' }).lean();
    expect(stored.spotifyScopes).toBe(ALL_SCOPES);
  });

  it('asks a user whose grant predates the new scopes to sign in again, without calling Spotify', async () => {
    const { user, token } = await createUserAndToken({ spotifyScopes: undefined });
    await User.updateOne({ _id: user._id }, { $unset: { spotifyScopes: '' } });

    const res = await request(app).get('/api/v1/player/devices').set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe(SPOTIFY_REAUTH_REQUIRED);
    expect(res.body.message).toBe(SPOTIFY_NEW_SCOPES_MESSAGE);
    expect(SpotifyService.getAvailableDevices).not.toHaveBeenCalled();
    expect(SpotifyService.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('treats a grant missing one scope the same way', async () => {
    const partial = SPOTIFY_SCOPES.filter((s) => s !== 'user-library-modify').join(' ');
    const { token } = await createUserAndToken({ spotifyScopes: partial });

    const res = await request(app).get('/api/v1/player/devices').set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe(SPOTIFY_REAUTH_REQUIRED);
  });

  it('lets a user with every scope through', async () => {
    const { token } = await createUserAndToken();
    SpotifyService.getAvailableDevices.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/v1/player/devices').set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });

  it('keeps the stored scopes current when a refresh reports them', async () => {
    const { user, token } = await createUserAndToken({ tokenExpiresAt: new Date(Date.now() - 60 * 1000) });
    const withExtra = `${ALL_SCOPES} ugc-image-upload`;
    SpotifyService.refreshAccessToken.mockResolvedValueOnce({ accessToken: 'new', refreshToken: 'r', expiresIn: 3600, scope: withExtra });
    SpotifyService.getAvailableDevices.mockResolvedValueOnce([]);

    await request(app).get('/api/v1/player/devices').set('Authorization', `Bearer ${token}`);

    const stored = await User.findById(user._id).lean();
    expect(stored.spotifyScopes).toBe(withExtra);
  });
});
