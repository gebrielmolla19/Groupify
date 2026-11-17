import type { Share, User } from '../types';

/** The API returns users with `_id`, `id` or both; compare on either. */
export const isUser = (a: Pick<User, '_id' | 'id'>, b: Pick<User, '_id' | 'id'> | null | undefined): boolean =>
  !!b && ((!!a._id && a._id === b._id) || (!!a.id && a.id === b.id));

export interface HeardStack {
  /** Who could hear the share, in group order, and whether they have. */
  members: { user: User; heard: boolean }[];
  heard: number;
  /** Members other than the sharer, or null when the members aren't loaded. */
  total: number | null;
}

/**
 * The "heard" stack on a song row: which members other than the sharer have
 * a listen on the share. Uses the share's existing `listeners`.
 */
export function heardStack(share: Share, members: User[]): HeardStack {
  const listeners = share.listeners.map((l) => l.user).filter((user) => user && !isUser(user, share.sharedBy));
  if (members.length === 0) {
    return { members: listeners.map((user) => ({ user, heard: true })), heard: listeners.length, total: null };
  }
  const audience = members
    .filter((user) => !isUser(user, share.sharedBy))
    .map((user) => ({ user, heard: listeners.some((l) => isUser(l, user)) }));
  return { members: audience, heard: audience.filter((m) => m.heard).length, total: audience.length };
}
