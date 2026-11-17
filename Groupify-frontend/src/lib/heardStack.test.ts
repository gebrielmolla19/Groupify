import { describe, it, expect } from 'vitest';
import { heardStack, isUser } from './heardStack';
import type { Share, User } from '../types';

const u = (id: string) => ({ _id: id, id, displayName: id.toUpperCase() }) as User;
const [me, a, b] = [u('me'), u('a'), u('b')];
const share = (sharedBy: User, listeners: User[]) =>
  ({ sharedBy, listeners: listeners.map((user) => ({ user, listenedAt: '', timeToListen: null })) }) as unknown as Share;

describe('isUser', () => {
  it('matches on either id field', () => {
    expect(isUser({ _id: 'x' } as User, { _id: 'x' } as User)).toBe(true);
    expect(isUser({ id: 'x' } as User, { id: 'x' } as User)).toBe(true);
    expect(isUser({ _id: 'x' } as User, { _id: 'y' } as User)).toBe(false);
    expect(isUser({ _id: 'x' } as User, null)).toBe(false);
  });
});

describe('heardStack', () => {
  it('counts every member except the sharer', () => {
    const stack = heardStack(share(me, [a]), [me, a, b]);
    expect(stack.total).toBe(2);
    expect(stack.heard).toBe(1);
    expect(stack.members.map((m) => [m.user._id, m.heard])).toEqual([['a', true], ['b', false]]);
  });

  it('ignores a sharer listening to their own share', () => {
    expect(heardStack(share(me, [me, a]), [me, a, b]).heard).toBe(1);
  });

  it('falls back to the listeners when members are not loaded', () => {
    const stack = heardStack(share(me, [a, b]), []);
    expect(stack.total).toBeNull();
    expect(stack.heard).toBe(2);
    expect(stack.members.every((m) => m.heard)).toBe(true);
  });
});
