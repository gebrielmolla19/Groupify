const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Group = require('../src/models/Group');
const { createUserAndToken, createGroup } = require('./helpers');

describe('Group Settings Routes', () => {
  describe('GET /api/v1/groups/:groupId/settings', () => {
    it('should return group settings when member', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Settings Group', description: 'Original desc' });

      const res = await request(app)
        .get(`/api/v1/groups/${group._id}/settings`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe('Settings Group');
      expect(res.body.data.description).toBe('Original desc');
    });

    it('should return 403 when not a member', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id, { name: 'Other Group' });
      const { token: otherToken } = await createUserAndToken();

      const res = await request(app)
        .get(`/api/v1/groups/${group._id}/settings`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('should return 401 when not authenticated', async () => {
      const { user } = await createUserAndToken();
      const group = await createGroup(user._id);

      const res = await request(app)
        .get(`/api/v1/groups/${group._id}/settings`);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/v1/groups/:groupId/settings', () => {
    it('should update group settings when member', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Update Group', description: 'Old' });

      const res = await request(app)
        .patch(`/api/v1/groups/${group._id}/settings`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', description: 'New description' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.description).toBe('New description');

      const updatedGroup = await Group.findById(group._id);
      expect(updatedGroup.name).toBe('Updated Name');
      expect(updatedGroup.description).toBe('New description');
    });

    it('should validate name max length', async () => {
      const { user, token } = await createUserAndToken();
      const group = await createGroup(user._id, { name: 'Short' });

      const longName = 'a'.repeat(101);
      const res = await request(app)
        .patch(`/api/v1/groups/${group._id}/settings`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: longName });

      expect(res.statusCode).toBe(400);
    });

    it('should return 403 when not a member', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id, { name: 'Other Group' });
      const { token: otherToken } = await createUserAndToken();

      const res = await request(app)
        .patch(`/api/v1/groups/${group._id}/settings`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ name: 'Hacked' });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/v1/groups/:groupId/members/:memberId', () => {
    it('should remove member when owner', async () => {
      const { user: owner, token: ownerToken } = await createUserAndToken();
      const { user: member, token: memberToken } = await createUserAndToken({ spotifyId: 'member-spotify-id' });
      const group = await createGroup(owner._id, { name: 'Remove Member Group' });
      group.members.push(member._id);
      await group.save();

      const res = await request(app)
        .delete(`/api/v1/groups/${group._id}/members/${member._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedGroup = await Group.findById(group._id);
      expect(updatedGroup.members.map(m => m.toString())).not.toContain(member._id.toString());
    });

    it('should return 403 when non-owner tries to remove member', async () => {
      const { user: owner } = await createUserAndToken();
      const { user: member, token: memberToken } = await createUserAndToken({ spotifyId: 'member2-spotify-id' });
      const { user: other, token: otherToken } = await createUserAndToken({ spotifyId: 'other-spotify-id' });
      const group = await createGroup(owner._id, { name: 'Three Member Group' });
      group.members.push(member._id, other._id);
      await group.save();

      const res = await request(app)
        .delete(`/api/v1/groups/${group._id}/members/${member._id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('should return 401 when not authenticated', async () => {
      const { user: owner } = await createUserAndToken();
      const { user: member } = await createUserAndToken({ spotifyId: 'mem-spotify-id' });
      const group = await createGroup(owner._id);
      group.members.push(member._id);
      await group.save();

      const res = await request(app)
        .delete(`/api/v1/groups/${group._id}/members/${member._id}`);

      expect(res.statusCode).toBe(401);
    });
  });
});
