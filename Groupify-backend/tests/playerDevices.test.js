const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { generateToken } = require('../src/middleware/authMiddleware');

jest.mock('../src/services/spotifyService', () => ({
  getAvailableDevices: jest.fn(),
  transferPlayback: jest.fn(),
  playTrack: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

const SpotifyService = require('../src/services/spotifyService');

describe('Player Devices Endpoint', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await User.create({
      spotifyId: 'test-spotify-id',
      displayName: 'Test User',
      email: 'test@example.com',
      spotifyAccessToken: 'access-token',
      spotifyRefreshToken: 'refresh-token',
      tokenExpiresAt: new Date(Date.now() + 3600000),
    });

    token = generateToken(user._id);
  });

  it('returns available devices from Spotify', async () => {
    SpotifyService.getAvailableDevices.mockResolvedValueOnce([
      {
        id: 'dev1',
        name: 'My Phone',
        is_active: true,
        is_private_session: false,
        is_restricted: false,
        type: 'Smartphone',
        volume_percent: 55,
      },
    ]);

    const res = await request(app)
      .get('/api/v1/player/devices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.devices)).toBe(true);
    expect(res.body.devices[0].id).toBe('dev1');
  });
});
