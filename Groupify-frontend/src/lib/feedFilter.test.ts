import { describe, it, expect } from 'vitest';
import { countShares, filterShares } from './feedFilter';
import type { Share, User } from '../types';

const u = (id: string) => ({ _id: id, id, displayName: id.toUpperCase() }) as User;
const [me, a, b] = [u('me'), u('a'), u('b')];
const share = (id: string, sharedBy: User, listeners: User[] = [], likes: User[] = []) =>
  ({
    _id: id,
    sharedBy,
    listeners: listeners.map((user) => ({ user, listenedAt: '', timeToListen: null })),
    likes: likes.map((user) => ({ user, likedAt: '' })),
  }) as unknown as Share;

// mine: shared by me. heard: a's share I've listened to. fresh: b's share I
// haven't. loved: a's share I like but haven't heard.
const mine = share('mine', me, [a]);
const heard = share('heard', a, [me]);
const fresh = share('fresh', b, [a]);
const loved = share('loved', a, [], [me]);
const shares = [mine, heard, fresh, loved];
const ids = (list: Share[]) => list.map((s) => s._id);

describe('filterShares', () => {
  it('All keeps every share in order', () => {
    expect(ids(filterShares(shares, 'all', me))).toEqual(['mine', 'heard', 'fresh', 'loved']);
  });

  it('Unheard keeps shares by others the viewer has no listen on', () => {
    expect(ids(filterShares(shares, 'unheard', me))).toEqual(['fresh', 'loved']);
  });

  it('Unheard never includes the viewer\'s own shares, even unheard ones', () => {
    expect(ids(filterShares([share('own', me)], 'unheard', me))).toEqual([]);
  });

  it('Yours keeps shares by the viewer', () => {
    expect(ids(filterShares(shares, 'yours', me))).toEqual(['mine']);
  });

  it('Liked keeps shares the viewer likes, not ones others like', () => {
    expect(ids(filterShares([...shares, share('theirs', me, [], [a])], 'liked', me))).toEqual(['loved']);
  });

  it('matches the viewer on either id field', () => {
    const viewer = { id: 'me' } as User;
    expect(ids(filterShares(shares, 'yours', viewer))).toEqual(['mine']);
  });

  it('tolerates a share with no likes array', () => {
    const bare = { ...mine, likes: undefined } as unknown as Share;
    expect(filterShares([bare], 'liked', me)).toEqual([]);
  });
});

describe('countShares', () => {
  it('counts each filter', () => {
    expect(countShares(shares, me)).toEqual({ all: 4, unheard: 2, yours: 1, liked: 1 });
  });

  it('counts nothing but All without a viewer', () => {
    expect(countShares(shares, null)).toEqual({ all: 4, unheard: 0, yours: 0, liked: 0 });
  });
});
