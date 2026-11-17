const request = require('supertest');
const axios = require('axios');
const app = require('../src/app');
const Group = require('../src/models/Group');
const Share = require('../src/models/Share');
const { createUserAndToken, createGroup } = require('./helpers');

jest.mock('axios');
jest.mock('../src/services/spotifyService', () => ({
  getUserProfile: jest.fn(),
  getPlaylistTracks: jest.fn(),
  replacePlaylistTracks: jest.fn(),
  createPlaylist: jest.fn(),
  addTracksToPlaylist: jest.fn(),
  followPlaylist: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

const SpotifyService = require('../src/services/spotifyService');

// The error spotifyService throws when Spotify answers 403 to a playlist call.
const spotify403 = (message = 'Insufficient permissions to access playlist: Forbidden') => {
  const error = new Error(message);
  error.statusCode = 403;
  error.spotifyError = 'Forbidden';
  return error;
};

const exportPlaylist = (groupId, token) =>
  request(app)
    .post(`/api/v1/spotify/groups/${groupId}/export-playlist`)
    .set('Authorization', `Bearer ${token}`)
    .send({});

// When Spotify refuses the owner's update of the stored playlist with a 403,
// Groupify should recover by creating a fresh playlist, as it does when the
// playlist was deleted (#85).
describe('Playlist export after Spotify refuses an update (403)', () => {
  let owner;
  let ownerToken;
  let group;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ user: owner, token: ownerToken } = await createUserAndToken({ spotifyId: 'owner-spotify' }));
    group = await createGroup(owner._id, {
      spotifyPlaylistId: 'old-playlist',
      spotifyPlaylistUrl: 'https://open.spotify.com/playlist/old-playlist',
      spotifyPlaylistOwnerId: owner._id,
    });
    await Share.create({
      group: group._id, sharedBy: owner._id,
      spotifyTrackId: 't1', trackName: 'Song 1', artistName: 'Artist A',
    });
    SpotifyService.getUserProfile.mockResolvedValue({ id: 'owner-spotify' });
  });

  it('creates a new playlist for the owner and stores it on the group', async () => {
    SpotifyService.getPlaylistTracks.mockRejectedValueOnce(spotify403());
    SpotifyService.createPlaylist.mockResolvedValueOnce({
      id: 'new-playlist',
      name: 'Test Group - Groupify Collaborative Playlist',
      external_urls: { spotify: 'https://open.spotify.com/playlist/new-playlist' },
    });
    SpotifyService.addTracksToPlaylist.mockResolvedValueOnce();
    SpotifyService.followPlaylist.mockResolvedValue();

    const res = await exportPlaylist(group._id, ownerToken);

    expect(res.statusCode).toBe(200);
    expect(res.body.isNewPlaylist).toBe(true);
    expect(res.body.replacedPlaylist).toBe(true);
    expect(res.body.playlistId).toBe('new-playlist');
    expect(res.body.message).toMatch(/new playlist/i);
    expect(SpotifyService.createPlaylist).toHaveBeenCalledTimes(1);

    const stored = await Group.findById(group._id).lean();
    expect(stored.spotifyPlaylistId).toBe('new-playlist');
    expect(String(stored.spotifyPlaylistOwnerId)).toBe(String(owner._id));
  });

  it('also recovers when the 403 comes from replacing the tracks', async () => {
    SpotifyService.getPlaylistTracks.mockResolvedValueOnce([]);
    SpotifyService.replacePlaylistTracks.mockRejectedValueOnce(spotify403('Insufficient permissions to modify playlist: Forbidden'));
    SpotifyService.createPlaylist.mockResolvedValueOnce({ id: 'new-playlist', name: 'New', external_urls: {} });
    SpotifyService.addTracksToPlaylist.mockResolvedValueOnce();
    SpotifyService.followPlaylist.mockResolvedValue();

    const res = await exportPlaylist(group._id, ownerToken);

    expect(res.statusCode).toBe(200);
    expect(res.body.replacedPlaylist).toBe(true);
    const stored = await Group.findById(group._id).lean();
    expect(stored.spotifyPlaylistId).toBe('new-playlist');
  });

  it('reports the error, tries once and keeps the stored playlist when creating a new one fails too', async () => {
    SpotifyService.getPlaylistTracks.mockRejectedValueOnce(spotify403());
    SpotifyService.createPlaylist.mockRejectedValueOnce(
      spotify403("Insufficient permissions to create playlist. Please ensure you have granted the 'playlist-modify-private' scope during login.")
    );

    const res = await exportPlaylist(group._id, ownerToken);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/create playlist/i);
    expect(SpotifyService.createPlaylist).toHaveBeenCalledTimes(1);
    const stored = await Group.findById(group._id).lean();
    expect(stored.spotifyPlaylistId).toBe('old-playlist');
  });

  it('does not let a member who does not own the playlist take it over', async () => {
    const { user: member, token: memberToken } = await createUserAndToken({ spotifyId: 'member-spotify' });
    await Group.updateOne({ _id: group._id }, { $push: { members: member._id } });
    axios.get.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { response: { status: 403 } }));

    const res = await exportPlaylist(group._id, memberToken);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/follow it first/i);
    expect(SpotifyService.createPlaylist).not.toHaveBeenCalled();
    const stored = await Group.findById(group._id).lean();
    expect(stored.spotifyPlaylistId).toBe('old-playlist');
  });
});
