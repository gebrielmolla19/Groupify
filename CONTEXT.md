# Groupify

Friends share Spotify tracks with each other in groups, play them
together, and compare how they share and listen.

## Language

### Groups and people

**Group**:
A private circle of members who share tracks with each other.

**Member**:
A user who belongs to a group.

**Owner**:
The member who created the group. A group has exactly one, and only the
owner can remove members, remove other members' shares, or delete the
group. Ownership never transfers: an owner who wants out deletes the
group.
_Avoid_: Creator, admin

**Invite**:
An offer to join a group, sent by a member to one specific user, who
accepts or declines it.

**Join code**:
A group's standing code that lets anyone who has it join without an
invite.
_Avoid_: Invite code, join link

**Activity**:
What happened in a member's groups that concerns them: a share, a member
joining, an invite to them. Each item is new until they open it or mark
it read. Stored as notifications, which is also how push sends them.
_Avoid_: Notifications (in the interface), feed (the feed is a group's shares)

### Music

**Track**:
A single piece of music on Spotify.
_Avoid_: Song

**Share**:
One track posted to one group by one member. A track can be shared only
once per group; the same track in another group is a different share.
_Avoid_: Post, song

**Playlist**:
A group's shares as a playable list. Exporting it to Spotify gives the
same playlist, on Spotify.
_Avoid_: Queue, feed (the feed is the screen that shows the shares)

**Listen**:
A member having played most of a share's track (at least 80%). Listens
are detected from playback, never declared by the member.
_Avoid_: Play, view

**Unheard**:
A share, from the point of view of one member, that someone else shared
and that member has no listen on yet. Your own shares are never unheard
to you.
_Avoid_: Unread, unplayed, new

**Like**:
A member marking a share as one they enjoyed.

### Group Dynamics

**Group Dynamics**:
The part of a group that shows how its members share and listen: the
measures below.
_Avoid_: Analytics, stats

**Listener Reflex**:
A member's listening habits in the group, chiefly how soon after a
track is shared they listen to it.

**Taste Gravity**:
How closely two members' music tastes relate, judged from what each has
listened to and liked in the group.

**Hall of Fame**:
The group's four awards: Trendsetter (most likes received), Hype Man
(most likes given), The DJ (most shares), Diehard (most listens).
_Avoid_: Superlatives

**Song journey**:
For one share, how long after it was shared each member listened, and
who hasn't yet. "Song" is kept here because it is the name members see;
in code and data the thing is still a share of a track.

**Song picker**:
The search, sort chips and list in Group Dynamics that find a share to
show its song journey.
