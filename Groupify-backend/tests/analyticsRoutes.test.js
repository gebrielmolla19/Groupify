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
});
