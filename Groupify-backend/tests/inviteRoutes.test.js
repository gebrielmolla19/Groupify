const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Group = require('../src/models/Group');
const Invite = require('../src/models/Invite');
const { createUserAndToken, createGroup, createUser } = require('./helpers');

describe('Invite Routes', () => {
  describe('POST /api/v1/groups/:groupId/invite', () => {
    it('should create an invite when member invites another user by spotifyId', async () => {
      const { user: owner, token: ownerToken } = await createUserAndToken({ spotifyId: 'owner-spotify-id' });
      const invitedUser = await createUser({ spotifyId: 'invited-spotify-id' });
      const group = await createGroup(owner._id, { name: 'Invite Group' });

      const res = await request(app)
        .post(`/api/v1/groups/${group._id}/invite`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ invitedUserSpotifyId: invitedUser.spotifyId });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.invite).toBeDefined();
      expect(res.body.invite.status).toBe('pending');
      expect(res.body.invite.group).toBeDefined();
      expect(res.body.invite.invitedUser).toBeDefined();

      const dbInvite = await Invite.findOne({ group: group._id, invitedUser: invitedUser._id });
      expect(dbInvite).toBeDefined();
      expect(dbInvite.status).toBe('pending');
    });

    it('should return 404 when invited user spotifyId not found', async () => {
      const { user: owner, token: ownerToken } = await createUserAndToken();
      const group = await createGroup(owner._id);

      const res = await request(app)
        .post(`/api/v1/groups/${group._id}/invite`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ invitedUserSpotifyId: 'nonexistent-spotify-id' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 401 when not authenticated', async () => {
      const { user } = await createUserAndToken();
      const group = await createGroup(user._id);

      const res = await request(app)
        .post(`/api/v1/groups/${group._id}/invite`)
        .send({ invitedUserSpotifyId: 'some-id' });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/groups/:groupId/invites', () => {
    it('should return invites for group when member', async () => {
      const { user: owner, token } = await createUserAndToken();
      const group = await createGroup(owner._id);
      const invitedUser = await createUser({ spotifyId: 'user-to-invite' });
      const invite = await Invite.create({
        group: group._id,
        invitedUser: invitedUser._id,
        invitedBy: owner._id,
        status: 'pending'
      });

      const res = await request(app)
        .get(`/api/v1/groups/${group._id}/invites`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.invites)).toBe(true);
      expect(res.body.invites.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 403 when not a member', async () => {
      const { user: owner } = await createUserAndToken();
      const group = await createGroup(owner._id);
      const { token: otherToken } = await createUserAndToken();

      const res = await request(app)
        .get(`/api/v1/groups/${group._id}/invites`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/groups/:groupId/invite/:inviteId/accept', () => {
    it('should accept invite when invited user', async () => {
      const { user: owner } = await createUserAndToken();
      const { user: invitedUser, token: invitedToken } = await createUserAndToken({ spotifyId: 'invited-user-spotify' });
      const group = await createGroup(owner._id);
      const invite = await Invite.create({
        group: group._id,
        invitedUser: invitedUser._id,
        invitedBy: owner._id,
        status: 'pending'
      });

      const res = await request(app)
        .post(`/api/v1/groups/${group._id}/invite/${invite._id}/accept`)
        .set('Authorization', `Bearer ${invitedToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.group).toBeDefined();

      const updatedInvite = await Invite.findById(invite._id);
      expect(updatedInvite.status).toBe('accepted');
      const updatedGroup = await Group.findById(group._id);
      expect(updatedGroup.members.map(m => m.toString())).toContain(invitedUser._id.toString());
    });

    it('should return 403 when non-invited user tries to accept', async () => {
      const { user: owner } = await createUserAndToken();
      const invitedUser = await createUser({ spotifyId: 'invited-spotify' });
      const { token: otherToken } = await createUserAndToken();
      const group = await createGroup(owner._id);
      const invite = await Invite.create({
        group: group._id,
        invitedUser: invitedUser._id,
        invitedBy: owner._id,
        status: 'pending'
      });

      const res = await request(app)
        .post(`/api/v1/groups/${group._id}/invite/${invite._id}/accept`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/groups/:groupId/invite/:inviteId/decline', () => {
    it('should decline invite when invited user', async () => {
      const { user: owner } = await createUserAndToken();
      const { user: invitedUser, token: invitedToken } = await createUserAndToken({ spotifyId: 'decline-invited-spotify' });
      const group = await createGroup(owner._id);
      const invite = await Invite.create({
        group: group._id,
        invitedUser: invitedUser._id,
        invitedBy: owner._id,
        status: 'pending'
      });

      const res = await request(app)
        .post(`/api/v1/groups/${group._id}/invite/${invite._id}/decline`)
        .set('Authorization', `Bearer ${invitedToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedInvite = await Invite.findById(invite._id);
      expect(updatedInvite.status).toBe('declined');
    });
  });
});
