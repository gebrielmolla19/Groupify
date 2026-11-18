const request = require('supertest');
const app = require('../src/app');
const Group = require('../src/models/Group');
const Share = require('../src/models/Share');
const { createUserAndToken, createGroup } = require('./helpers');

const DAY = 24 * 60 * 60 * 1000;
let trackSeq = 0;

/** A share created `daysAgo` days ago, optionally with listens. */
async function share(groupId, sharedBy, { daysAgo = 0, listeners = [] } = {}) {
  trackSeq += 1;
  const at = new Date(Date.now() - daysAgo * DAY);
  const doc = await Share.create({
    group: groupId,
    sharedBy,
    spotifyTrackId: `track${trackSeq}`,
    trackName: `Track ${trackSeq}`,
    artistName: 'Artist',
    listeners: listeners.map((user) => ({ user, listenedAt: at })),
  });
  // timestamps: true sets createdAt on create; backdate it for ordering.
  await Share.collection.updateOne({ _id: doc._id }, { $set: { createdAt: at } });
  return doc;
}

const get = (token, query = '') =>
  request(app).get(`/api/v1/shares/unheard${query}`).set('Authorization', `Bearer ${token}`);

describe('GET /api/v1/shares/unheard', () => {
  it('returns shares by others the user has no listen on, across their groups, newest first', async () => {
    const { user: me, token } = await createUserAndToken({ displayName: 'Me' });
    const { user: friend } = await createUserAndToken({ displayName: 'Friend' });
    const a = await createGroup(me._id, { name: 'Group A', members: [me._id, friend._id] });
    const b = await createGroup(friend._id, { name: 'Group B', members: [friend._id, me._id] });

    const old = await share(a._id, friend._id, { daysAgo: 5 });
    const recent = await share(b._id, friend._id, { daysAgo: 1 });
    await share(a._id, friend._id, { daysAgo: 2, listeners: [me._id] }); // heard
    await share(a._id, me._id, { daysAgo: 1 }); // mine

    const res = await get(token);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.shares.map((s) => s._id)).toEqual([recent._id.toString(), old._id.toString()]);
    expect(res.body.shares[0].group).toMatchObject({ _id: b._id.toString(), name: 'Group B' });
    expect(res.body.shares[0].sharedBy).toMatchObject({ displayName: 'Friend' });
    expect(res.body.total).toBe(2);
    expect(res.body.byGroup).toEqual({ [a._id.toString()]: 1, [b._id.toString()]: 1 });
  });

  it('populates listens and likes like the group feed', async () => {
    const { user: me, token } = await createUserAndToken();
    const { user: friend } = await createUserAndToken({ displayName: 'Friend' });
    const { user: other } = await createUserAndToken({ displayName: 'Other' });
    const group = await createGroup(me._id, { members: [me._id, friend._id, other._id] });
    const s = await share(group._id, friend._id, { listeners: [other._id] });
    await Share.updateOne({ _id: s._id }, { $push: { likes: { user: me._id, likedAt: new Date() } } });

    const [unheard] = (await get(token)).body.shares;

    expect(unheard.listeners[0].user).toMatchObject({ _id: other._id.toString(), displayName: 'Other' });
    expect(unheard.likes[0].user).toMatchObject({ _id: me._id.toString() });
  });

  it('counts the unheard shares from the last 7 days', async () => {
    const { user: me, token } = await createUserAndToken();
    const { user: friend } = await createUserAndToken();
    const group = await createGroup(me._id, { members: [me._id, friend._id] });
    await share(group._id, friend._id, { daysAgo: 1 });
    await share(group._id, friend._id, { daysAgo: 6 });
    await share(group._id, friend._id, { daysAgo: 8 });
    await share(group._id, friend._id, { daysAgo: 2, listeners: [me._id] }); // heard

    const res = await get(token, '?limit=1');

    expect(res.body.newThisWeek).toBe(2);
    expect(res.body.total).toBe(3);
  });

  it('reports the oldest unheard share date', async () => {
    const { user: me, token } = await createUserAndToken();
    const { user: friend } = await createUserAndToken();
    const group = await createGroup(me._id, { members: [me._id, friend._id] });
    await share(group._id, friend._id, { daysAgo: 1 });
    const oldest = await share(group._id, friend._id, { daysAgo: 4 });

    const res = await get(token);

    const stored = await Share.findById(oldest._id).lean();
    expect(new Date(res.body.oldestAt).toISOString()).toBe(stored.createdAt.toISOString());
  });

  it('ignores groups the user is not in and inactive groups', async () => {
    const { user: me, token } = await createUserAndToken();
    const { user: friend } = await createUserAndToken();
    const notMine = await createGroup(friend._id);
    const gone = await createGroup(friend._id, { members: [friend._id, me._id], isActive: false });
    await share(notMine._id, friend._id);
    await share(gone._id, friend._id);

    const res = await get(token);

    expect(res.body).toMatchObject({ shares: [], total: 0, newThisWeek: 0, byGroup: {}, oldestAt: null });
  });

  it('caps the list with limit but still counts everything', async () => {
    const { user: me, token } = await createUserAndToken();
    const { user: friend } = await createUserAndToken();
    const group = await createGroup(me._id, { members: [me._id, friend._id] });
    for (let i = 0; i < 3; i += 1) await share(group._id, friend._id, { daysAgo: i });

    const res = await get(token, '?limit=2');

    expect(res.body.shares).toHaveLength(2);
    expect(res.body.total).toBe(3);
  });

  it('narrows to one group with groupId, only if the user is in it', async () => {
    const { user: me, token } = await createUserAndToken();
    const { user: friend } = await createUserAndToken();
    const a = await createGroup(me._id, { members: [me._id, friend._id] });
    const b = await createGroup(me._id, { members: [me._id, friend._id] });
    const notMine = await createGroup(friend._id);
    const inA = await share(a._id, friend._id);
    await share(b._id, friend._id);
    await share(notMine._id, friend._id);

    const res = await get(token, `?groupId=${a._id}`);
    expect(res.body.shares.map((s) => s._id)).toEqual([inA._id.toString()]);
    expect(res.body.total).toBe(1);
    expect(res.body.byGroup).toEqual({ [a._id.toString()]: 1 });

    expect((await get(token, `?groupId=${notMine._id}`)).body.total).toBe(0);
    expect((await get(token, '?groupId=nope')).statusCode).toBe(400);
  });

  it('rejects a bad limit', async () => {
    const { token } = await createUserAndToken();
    expect((await get(token, '?limit=0')).statusCode).toBe(400);
    expect((await get(token, '?limit=101')).statusCode).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/shares/unheard');
    expect(res.statusCode).toBe(401);
  });

  it('does not leak shares to a group the user left', async () => {
    const { user: me, token } = await createUserAndToken();
    const { user: friend } = await createUserAndToken();
    const group = await createGroup(friend._id, { members: [friend._id, me._id] });
    await share(group._id, friend._id);
    await Group.updateOne({ _id: group._id }, { $pull: { members: me._id } });

    expect((await get(token)).body.total).toBe(0);
  });
});
