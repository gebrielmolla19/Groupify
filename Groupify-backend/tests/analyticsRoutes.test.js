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

    it('breaks each member\'s listens into timing buckets, leaving out their own shares', async () => {
      const MIN = 60 * 1000;
      const DAY = 24 * 60 * MIN;
      const { user: me, token } = await createUserAndToken({ displayName: 'Me' });
      const { user: friend } = await createUserAndToken({ displayName: 'Friend' });
      const group = await createGroup(me._id, { members: [me._id, friend._id] });
      const sharedAt = new Date(Date.now() - 10 * DAY);
      const listen = (user, ms) => ({ user: user._id, listenedAt: new Date(sharedAt.getTime() + ms), timeToListen: ms });
      const share = (sharedBy, n, listeners) => Share.create({
        group: group._id,
        sharedBy: sharedBy._id,
        spotifyTrackId: `track-${n}`,
        trackName: `Track ${n}`,
        artistName: 'Sample Artist',
        createdAt: sharedAt,
        listeners
      });

      await share(friend, 1, [listen(me, 5 * MIN)]);
      await share(friend, 2, [listen(me, 3 * DAY)]);
      // Me playing my own share doesn't count as a reflex.
      await share(me, 3, [listen(me, 1 * MIN), listen(friend, 8 * DAY)]);

      const received = await request(app)
        .get(`/api/v1/analytics/${group._id}/listener-reflex`)
        .set('Authorization', `Bearer ${token}`)
        .query({ range: '30d', mode: 'received' });
      const shared = await request(app)
        .get(`/api/v1/analytics/${group._id}/listener-reflex`)
        .set('Authorization', `Bearer ${token}`)
        .query({ range: '30d', mode: 'shared' });

      const byId = (res, user) => res.body.data.users.find((u) => u.userId === user._id.toString());
      expect(byId(received, me)).toMatchObject({
        listens: 2,
        timing: { sameHour: 1, sameDay: 0, withinWeek: 1, later: 0 }
      });
      expect(byId(received, friend).timing).toEqual({ sameHour: 0, sameDay: 0, withinWeek: 0, later: 1 });
      expect(byId(shared, me)).toMatchObject({
        listens: 1,
        timing: { sameHour: 0, sameDay: 0, withinWeek: 0, later: 1 }
      });
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

  describe('GET /api/v1/analytics/:id/between', () => {
    it('returns the pair, biggest fan and tastemaker for the signed-in member', async () => {
      const { user: me, token } = await createUserAndToken({ displayName: 'Me' });
      const { user: ana } = await createUserAndToken({ displayName: 'Ana' });
      const { user: bo } = await createUserAndToken({ displayName: 'Bo' });
      const group = await createGroup(me._id, { members: [me._id, ana._id, bo._id] });
      const sharedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      await Share.create({
        group: group._id,
        sharedBy: me._id,
        spotifyTrackId: 'track-mine',
        trackName: 'Mine',
        artistName: 'Sample Artist',
        createdAt: sharedAt,
        listeners: [{ user: bo._id, listenedAt: sharedAt, timeToListen: 60000 }],
        likes: [{ user: bo._id }]
      });
      await Share.create({
        group: group._id,
        sharedBy: ana._id,
        spotifyTrackId: 'track-ana',
        trackName: 'Theirs',
        artistName: 'Other Artist',
        createdAt: sharedAt,
        likes: [{ user: me._id }]
      });

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/between`)
        .set('Authorization', `Bearer ${token}`)
        .query({ range: '30d', member: ana._id.toString() });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.members.map((m) => m.displayName)).toEqual(['Ana', 'Bo']);
      expect(res.body.data.pair).toMatchObject({
        member: ana._id.toString(),
        theirShares: 1,
        youLiked: 1,
        yourShares: 1,
        theyLiked: 0,
        verdict: { id: 'too_early' }
      });
      expect(res.body.data.biggestFan).toMatchObject({ members: [bo._id.toString()], listens: 1, likes: 1 });
    });

    it('returns 403 when not a group member', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id);
      const { token: otherToken } = await createUserAndToken();

      const res = await request(app)
        .get(`/api/v1/analytics/${group._id}/between`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('returns 400 for an unknown range, a malformed member id, or someone outside the group', async () => {
      const { user, token } = await createUserAndToken();
      const { user: friend } = await createUserAndToken();
      const { user: stranger } = await createUserAndToken();
      const group = await createGroup(user._id, { members: [user._id, friend._id] });
      const get = (query) => request(app)
        .get(`/api/v1/analytics/${group._id}/between`)
        .set('Authorization', `Bearer ${token}`)
        .query(query);

      expect((await get({ range: '24h' })).statusCode).toBe(400);
      expect((await get({ member: 'not-an-id' })).statusCode).toBe(400);
      expect((await get({ member: stranger._id.toString() })).statusCode).toBe(400);
      expect((await get({ member: user._id.toString() })).statusCode).toBe(400);
      expect((await get({ member: friend._id.toString() })).statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/analytics/listener-reflex/radar', () => {
    it('is gone: the radar was removed with compare mode (#149)', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id);

      const res = await request(app)
        .get('/api/v1/analytics/listener-reflex/radar')
        .set('Authorization', `Bearer ${token}`)
        .query({ groupId: group._id.toString() });

      expect(res.statusCode).toBe(404);
    });
  });
});
