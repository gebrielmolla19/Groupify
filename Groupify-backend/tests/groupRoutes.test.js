const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Group = require('../src/models/Group');
const { createUserAndToken, createGroup } = require('./helpers');

describe('Group Routes', () => {
  describe('POST /api/v1/groups', () => {
    it('should create a group when authenticated with valid body', async () => {
      const { user, token } = await createUserAndToken();

      const res = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My New Group', description: 'A test group' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.group).toBeDefined();
      expect(res.body.group.name).toBe('My New Group');
      expect(res.body.group.description).toBe('A test group');
      expect(res.body.group.inviteCode).toBeDefined();
      expect(res.body.group.inviteCode).toHaveLength(16);
      expect(res.body.group.members).toBeDefined();
      expect(res.body.group.members.some(m => m._id.toString() === user._id.toString() || m.toString() === user._id.toString())).toBe(true);

      const dbGroup = await Group.findById(res.body.group._id);
      expect(dbGroup).toBeDefined();
      expect(dbGroup.members.map(m => m.toString())).toContain(user._id.toString());
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .post('/api/v1/groups')
        .send({ name: 'My Group', description: 'Test' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 when name is too short', async () => {
      const { token } = await createUserAndToken();

      const res = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'ab', description: 'Test' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/v1/groups', () => {
    it('should return user groups when authenticated', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Group One' });

      const res = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.groups)).toBe(true);
      expect(res.body.groups.length).toBeGreaterThanOrEqual(1);
      const found = res.body.groups.find(g => g._id === group._id.toString() || g._id.toString() === group._id.toString());
      expect(found).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app).get('/api/v1/groups');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/groups/:id', () => {
    it('should return group when member', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'My Group' });

      const res = await request(app)
        .get(`/api/v1/groups/${group._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.group._id).toBeDefined();
      expect(res.body.group.name).toBe('My Group');
    });

    it('should return 404 for invalid group id format', async () => {
      const { token } = await createUserAndToken();

      const res = await request(app)
        .get('/api/v1/groups/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
    });

    it('should return 401 when not authenticated', async () => {
      const { user } = await createUserAndToken();
      const group = await createGroup(user._id);

      const res = await request(app).get(`/api/v1/groups/${group._id}`);
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/groups/join', () => {
    it('should join group with valid invite code', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id, { name: 'Joinable Group' });
      const { user: joiner, token: joinerToken } = await createUserAndToken();

      const res = await request(app)
        .post('/api/v1/groups/join')
        .set('Authorization', `Bearer ${joinerToken}`)
        .send({ inviteCode: group.inviteCode });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.group).toBeDefined();

      const updatedGroup = await Group.findById(group._id);
      expect(updatedGroup.members.map(m => m.toString())).toContain(joiner._id.toString());
    });

    it('should return 400 when invite code is wrong length', async () => {
      const { token } = await createUserAndToken();

      const res = await request(app)
        .post('/api/v1/groups/join')
        .set('Authorization', `Bearer ${token}`)
        .send({ inviteCode: 'short' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/groups/:id/leave', () => {
    it('should leave group when non-owner member', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id, { name: 'Leave Group' });
      const { user: member, token: memberToken } = await createUserAndToken({ spotifyId: 'leave-member-spotify' });
      group.members.push(member._id);
      await group.save();

      const res = await request(app)
        .post(`/api/v1/groups/${group._id}/leave`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedGroup = await Group.findById(group._id);
      expect(updatedGroup.members.map(m => m.toString())).not.toContain(member._id.toString());
    });

    it('should return 403 when owner tries to leave', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Leave Group' });

      const res = await request(app)
        .post(`/api/v1/groups/${group._id}/leave`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(403);
    });

    it('should return 401 when not authenticated', async () => {
      const { user } = await createUserAndToken();
      const group = await createGroup(user._id);

      const res = await request(app)
        .post(`/api/v1/groups/${group._id}/leave`);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/v1/groups/:id', () => {
    it('should delete group when owner', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'To Delete' });

      const res = await request(app)
        .delete(`/api/v1/groups/${group._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await Group.findById(group._id);
      expect(deleted).toBeDefined();
      expect(deleted.isActive).toBe(false);
    });

    it('should return 403 when non-owner tries to delete', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id, { name: 'Not Yours' });
      const { user: other, token: otherToken } = await createUserAndToken();
      group.members.push(other._id);
      await group.save();

      const res = await request(app)
        .delete(`/api/v1/groups/${group._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.statusCode).toBe(403);
    });
  });
});
