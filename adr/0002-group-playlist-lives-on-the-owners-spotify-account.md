# A group's Spotify playlist lives on the owner's Spotify account

Spotify has no playlists that belong to a group of people: every
playlist belongs to one account. When a group's playlist is exported to
Spotify, it is created as a collaborative playlist on the group owner's
account, and only the owner may trigger that first export. Other members
follow the playlist instead. Letting whichever member exported first own
it was rejected: the playlist would land on an arbitrary account and the
owner could be locked out of updating it.

## Consequences

- The group's owner and the Spotify playlist's account are assumed to be
  the same person. This is one reason ownership of a group never
  transfers: Spotify can't move a playlist to another account.
- If the playlist no longer exists on Spotify, the owner's next export
  creates a new one.
- If the owner loses access to it, the export fails with an error and
  the group stays tied to the old playlist.
