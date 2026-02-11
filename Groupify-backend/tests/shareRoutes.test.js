const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Group = require('../src/models/Group');
const Share = require('../src/models/Share');
const { createUserAndToken, createGroup } = require('./helpers');

jest.mock('../src/services/spotifyService', () => ({
  getTrackDetails: jest.fn()
}));
jest.mock('../src/utils/tokenManager', () => ({
  getValidAccessToken: jest.fn()
}));

const SpotifyService = require('../src/services/spotifyService');
const TokenManager = require('../src/utils/tokenManager');

describe('Share Routes', () => {
  const validSpotifyTrackId = '0a1b2c3d4e5f6g7h8i9j0k'; // 22 alphanumeric chars

  beforeEach(() => {
    SpotifyService.getTrackDetails.mockResolvedValue({
      id: validSpotifyTrackId,
      name: 'Test Track',
      artists: [{ name: 'Test Artist' }],
      album: { name: 'Test Album', images: [{ url: 'https://example.com/img.jpg' }] },
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/xxx' },
      duration_ms: 180000
    });
    TokenManager.getValidAccessToken.mockResolvedValue('mock-access-token');
  });

  describe('POST /api/v1/shares', () => {
    it('should share a song to a group when member', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Share Group' });

      const res = await request(app)
        .post('/api/v1/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({
          groupId: group._id.toString(),
          spotifyTrackId: validSpotifyTrackId
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.share).toBeDefined();
      expect(res.body.share.spotifyTrackId).toBe(validSpotifyTrackId);
      expect(res.body.share.trackName).toBe('Test Track');
      expect(res.body.share.artistName).toBe('Test Artist');

      const dbShare = await Share.findOne({ group: group._id, sharedBy: user._id });
      expect(dbShare).toBeDefined();
    });

    it('should return 404 when group not found or not a member', async () => {
      const { user, token } = await createUserAndToken();
      const { user: other } = await createUserAndToken();
      const group = await createGroup(other._id, { name: 'Other Group' });

      const res = await request(app)
        .post('/api/v1/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({
          groupId: group._id.toString(),
          spotifyTrackId: validSpotifyTrackId
        });

      expect(res.statusCode).toBe(404);
    });

    it('should return 401 when not authenticated', async () => {
      const { user } = await createUserAndToken();
      const group = await createGroup(user._id);

      const res = await request(app)
        .post('/api/v1/shares')
        .send({
          groupId: group._id.toString(),
          spotifyTrackId: validSpotifyTrackId
        });

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 when spotifyTrackId invalid format', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id);

      const res = await request(app)
        .post('/api/v1/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({
          groupId: group._id.toString(),
          spotifyTrackId: 'short'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/shares/groups/:groupId', () => {
    it('should return group feed when member', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Feed Group' });
      const share = await Share.create({
        group: group._id,
        sharedBy: user._id,
        spotifyTrackId: 'track12345678901234567890',
        trackName: 'Track',
        artistName: 'Artist'
      });

      const res = await request(app)
        .get(`/api/v1/shares/groups/${group._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.shares)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('should return 403 when not a member', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id);
      const { token: otherToken } = await createUserAndToken();

      const res = await request(app)
        .get(`/api/v1/shares/groups/${group._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/shares/:shareId/listen', () => {
    it('should mark share as listened when member of group', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id);
      const share = await Share.create({
        group: group._id,
        sharedBy: user._id,
        spotifyTrackId: 'track12345678901234567890',
        trackName: 'Track',
        artistName: 'Artist'
      });

      const res = await request(app)
        .post(`/api/v1/shares/${share._id}/listen`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.share.listenCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PUT /api/v1/shares/:shareId/like', () => {
    it('should toggle like on share when member', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id);
      const share = await Share.create({
        group: group._id,
        sharedBy: user._id,
        spotifyTrackId: 'track12345678901234567890',
        trackName: 'Track',
        artistName: 'Artist'
      });

      const res = await request(app)
        .put(`/api/v1/shares/${share._id}/like`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.share).toBeDefined();
    });
  });

  describe('DELETE /api/v1/shares/:shareId', () => {
    it('should remove share when sharer or authorized', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id);
      const share = await Share.create({
        group: group._id,
        sharedBy: user._id,
        spotifyTrackId: 'track12345678901234567890',
        trackName: 'Track',
        artistName: 'Artist'
      });

      const res = await request(app)
        .delete(`/api/v1/shares/${share._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await Share.findById(share._id);
      expect(deleted).toBeNull();
    });
  });
});
