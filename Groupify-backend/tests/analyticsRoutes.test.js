const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Group = require('../src/models/Group');
const Share = require('../src/models/Share');
const { createUserAndToken, createGroup } = require('./helpers');

describe('Analytics Routes', () => {
  describe('GET /api/v1/analytics/:id/activity', () => {
    it('should return group activity when authenticated', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Analytics Group' });

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/activity`)
        .set('Authorization', `Bearer ${token}`)
        .query({ timeRange: '7d' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const { user } = await createUserAndToken();
      const group = await createGroup(user._id);

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/activity`);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/analytics/:id/vibes', () => {
    it('should return member vibes when authenticated', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Vibes Group' });

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/vibes`)
        .set('Authorization', `Bearer ${token}`)
        .query({ timeRange: '30d' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/analytics/:id/superlatives', () => {
    it('should return superlatives when authenticated', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Superlatives Group' });

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/superlatives`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('accepts a timeRange', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id);

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/superlatives`)
        .set('Authorization', `Bearer ${token}`)
        .query({ timeRange: '7d' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for invalid timeRange', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id);

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/superlatives`)
        .set('Authorization', `Bearer ${token}`)
        .query({ timeRange: '24h' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/analytics/:id/taste-gravity', () => {
    it('should return taste gravity when group member', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Taste Group' });

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/taste-gravity`)
        .set('Authorization', `Bearer ${token}`)
        .query({ timeRange: '7d' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.nodes).toBeDefined();
      expect(Array.isArray(res.body.data.nodes)).toBe(true);
      expect(res.body.data.links).toBeDefined();
      expect(Array.isArray(res.body.data.links)).toBe(true);
    });

    it('should return 403 when not a group member', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id, { name: 'Other Group' });
      const { token: otherToken } = await createUserAndToken();

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/taste-gravity`)
        .set('Authorization', `Bearer ${otherToken}`)
        .query({ timeRange: '7d' });

      expect(res.statusCode).toBe(403);
    });

    it('should return 400 for invalid timeRange', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id);

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/taste-gravity`)
        .set('Authorization', `Bearer ${token}`)
        .query({ timeRange: 'invalid' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/analytics/:id/listener-reflex', () => {
    it('should return listener reflex when group member', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Reflex Group' });

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/listener-reflex`)
        .set('Authorization', `Bearer ${token}`)
        .query({ range: '30d', mode: 'received' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should return 403 when not a group member', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id, { name: 'Other Group' });
      const { token: otherToken } = await createUserAndToken();

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/listener-reflex`)
        .set('Authorization', `Bearer ${otherToken}`)
        .query({ range: '30d' });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/analytics/:id/you', () => {
    it('returns the signed-in member\'s numbers, not another member\'s', async () => {
      const { user: me, token } = await createUserAndToken({ displayName: 'Me' });
      const { user: friend } = await createUserAndToken({ displayName: 'Friend' });
      const group = await createGroup(me._id, { members: [me._id, friend._id] });
      const sharedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      await Share.create({
        group: group._id,
        sharedBy: me._id,
        spotifyTrackId: 'track-mine',
        trackName: 'Mine',
        artistName: 'Sample Artist',
        createdAt: sharedAt,
        listeners: [{ user: friend._id, listenedAt: new Date(sharedAt.getTime() + 60000), timeToListen: 60000 }],
        likes: [{ user: friend._id }]
      });
      await Share.create({
        group: group._id,
        sharedBy: friend._id,
        spotifyTrackId: 'track-theirs',
        trackName: 'Theirs',
        artistName: 'Other Artist',
        createdAt: sharedAt
      });

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/you`)
        .set('Authorization', `Bearer ${token}`)
        .query({ range: '30d', tz: 'America/New_York' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.hitRate).toEqual({ hits: 1, total: 1 });
      expect(res.body.data.bestShare).toMatchObject({ trackName: 'Mine', listens: 1, likes: 1, others: 1 });
      expect(res.body.data.reflex.yoursPlayedMs).toBe(60000);
    });

    it('returns 403 when not a group member', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id);
      const { token: otherToken } = await createUserAndToken();

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/you`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('returns 400 for an unknown range or time zone', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id);

      const badRange = await request(app)
        .get(`/api/v1/analytics/${group._id}/you`)
        .set('Authorization', `Bearer ${token}`)
        .query({ range: '24h' });
      const badZone = await request(app)
        .get(`/api/v1/analytics/${group._id}/you`)
        .set('Authorization', `Bearer ${token}`)
        .query({ tz: 'Not/AZone' });

      expect(badRange.statusCode).toBe(400);
      expect(badZone.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/analytics/listener-reflex/radar', () => {
    it('should return listener reflex radar when group member', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Radar Group' });

      const res = await request(app)
        .get('/api/v1/analytics/listener-reflex/radar')
        .set('Authorization', `Bearer ${token}`)
        .query({ groupId: group._id.toString(), window: '30d', mode: 'received' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should return 400 when groupId missing', async () => {
      const { token } = await createUserAndToken();

      const res = await request(app)
        .get('/api/v1/analytics/listener-reflex/radar')
        .set('Authorization', `Bearer ${token}`)
        .query({ window: '30d' });

      expect(res.statusCode).toBe(400);
    });

    it('should return 403 when not a group member', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id, { name: 'Other Group' });
      const { token: otherToken } = await createUserAndToken();

      const res = await request(app)
        .get('/api/v1/analytics/listener-reflex/radar')
        .set('Authorization', `Bearer ${otherToken}`)
        .query({ groupId: group._id.toString(), window: '30d' });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/analytics/:id/golden-hour', () => {
    it('returns the group\'s heatmap and streak in the viewer\'s time zone', async () => {
      const { user: me, token } = await createUserAndToken({ displayName: 'Me' });
      const { user: friend } = await createUserAndToken({ displayName: 'Friend' });
      const group = await createGroup(me._id, { members: [me._id, friend._id] });
      const sharedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);

      await Share.create({
        group: group._id,
        sharedBy: me._id,
        spotifyTrackId: 'track-golden',
        trackName: 'Golden',
        artistName: 'Sample Artist',
        createdAt: sharedAt,
        listeners: [{ user: friend._id, listenedAt: new Date(sharedAt.getTime() + 60000), timeToListen: 60000 }]
      });

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/golden-hour`)
        .set('Authorization', `Bearer ${token}`)
        .query({ range: '7d', tz: 'Asia/Tokyo' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.range).toBe('7d');
      expect(res.body.data.totals).toEqual({ shares: 1, listens: 1 });
      expect(res.body.data.shares).toHaveLength(7);
      expect(res.body.data.buckets).toHaveLength(6);
      expect(res.body.data.streak.current).toBeGreaterThanOrEqual(1);
    });

    it('returns 403 when not a group member', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id);
      const { token: otherToken } = await createUserAndToken();

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/golden-hour`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('returns 401 when not authenticated', async () => {
      const { user } = await createUserAndToken();
      const group = await createGroup(user._id);

      const res = await request(app).get(`/api/v1/analytics/${group._id}/golden-hour`);

      expect(res.statusCode).toBe(401);
    });

    it('returns 400 for an unknown range or time zone', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id);

      const badRange = await request(app)
        .get(`/api/v1/analytics/${group._id}/golden-hour`)
        .set('Authorization', `Bearer ${token}`)
        .query({ range: '24h' });
      const badZone = await request(app)
        .get(`/api/v1/analytics/${group._id}/golden-hour`)
        .set('Authorization', `Bearer ${token}`)
        .query({ tz: 'Not/AZone' });

      expect(badRange.statusCode).toBe(400);
      expect(badZone.statusCode).toBe(400);
    });
  });
});
