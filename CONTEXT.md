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
group.
_Avoid_: Creator, admin

**Invite**:
An offer to join a group, sent by a member to one specific user, who
accepts or declines it.

**Join code**:
A group's standing code that lets anyone who has it join without an
invite.
_Avoid_: Invite code, join link

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

**Like**:
A member marking a share as one they enjoyed.
