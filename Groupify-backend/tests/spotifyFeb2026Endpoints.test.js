const axios = require('axios');
const SpotifyService = require('../src/services/spotifyService');

jest.mock('axios');

// February 2026: Spotify removed these endpoints for development-mode apps
// and named replacements (#87, research/spotify.md §4a). Each test pins the
// replacement's path and request shape, and that the removed path is gone.
const API = 'https://api.spotify.com/v1';
const uris = (n) => Array.from({ length: n }, (_, i) => `spotify:track:t${i}`);
const calledUrls = () => [axios.get, axios.post, axios.put, axios.delete]
  .flatMap((fn) => fn.mock.calls.map((c) => c[0]));

describe('Spotify endpoints after the February 2026 changes', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    for (const url of calledUrls()) {
      expect(url).not.toMatch(/\/playlists\/[^/]+\/(tracks|followers)$|\/users\/[^/]+\/playlists$|\/audio-features/);
    }
  });

  it('creates the playlist with POST /me/playlists', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'p1' } });

    const playlist = await SpotifyService.createPlaylist('tok', 'Sample Group', 'desc', false, true);

    expect(playlist.id).toBe('p1');
    expect(axios.post).toHaveBeenCalledWith(
      `${API}/me/playlists`,
      { name: 'Sample Group', description: 'desc', public: false, collaborative: true },
      expect.anything()
    );
  });

  it('adds tracks with POST /playlists/{id}/items, 100 per request', async () => {
    axios.post.mockResolvedValue({ data: { snapshot_id: 's' } });

    await SpotifyService.addTracksToPlaylist('tok', 'p1', uris(150));

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post.mock.calls[0][0]).toBe(`${API}/playlists/p1/items`);
    expect(axios.post.mock.calls[0][1].uris).toHaveLength(100);
    expect(axios.post.mock.calls[1][1].uris).toHaveLength(50);
  });

  it('replaces the playlist with one PUT /playlists/{id}/items, then appends anything past 100', async () => {
    axios.put.mockResolvedValueOnce({ data: { snapshot_id: 's1' } });
    axios.post.mockResolvedValueOnce({ data: { snapshot_id: 's2' } });

    await SpotifyService.replacePlaylistTracks('tok', 'p1', uris(120));

    expect(axios.put).toHaveBeenCalledWith(`${API}/playlists/p1/items`, { uris: uris(100) }, expect.anything());
    expect(axios.post).toHaveBeenCalledWith(`${API}/playlists/p1/items`, { uris: uris(120).slice(100) }, expect.anything());
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it('clears the playlist when there is nothing to put in it', async () => {
    axios.put.mockResolvedValueOnce({ data: { snapshot_id: 's1' } });

    await SpotifyService.replacePlaylistTracks('tok', 'p1', []);

    expect(axios.put).toHaveBeenCalledWith(`${API}/playlists/p1/items`, { uris: [] }, expect.anything());
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('reads the playlist with GET /playlists/{id}/items, 50 per page', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { items: [{ item: { uri: 'a' } }], next: 'more' } })
      .mockResolvedValueOnce({ data: { items: [{ item: { uri: 'b' } }], next: null } });

    const items = await SpotifyService.getPlaylistTracks('tok', 'p1');

    expect(items.map((i) => i.item.uri)).toEqual(['a', 'b']);
    expect(axios.get.mock.calls[0][0]).toBe(`${API}/playlists/p1/items`);
    expect(axios.get.mock.calls[0][1].params).toEqual({ limit: 50, offset: 0 });
    expect(axios.get.mock.calls[1][1].params).toEqual({ limit: 50, offset: 50 });
  });

  it('follows the playlist by saving its URI with PUT /me/library', async () => {
    axios.put.mockResolvedValueOnce({ data: {} });

    await SpotifyService.followPlaylist('tok', 'p1');

    expect(axios.put).toHaveBeenCalledWith(
      `${API}/me/library`,
      null,
      expect.objectContaining({ params: { uris: 'spotify:playlist:p1' } })
    );
  });

  it('reports a 403 from following instead of treating it as "already following"', async () => {
    axios.put.mockRejectedValueOnce({ response: { status: 403, data: { error: { message: 'Insufficient client scope' } } } });

    await expect(SpotifyService.followPlaylist('tok', 'p1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it.each([[undefined, 10], [20, 10], [50, 10], [5, 5]])('asks search for at most 10 results (asked %p → %p)', async (asked, sent) => {
    axios.get.mockResolvedValueOnce({ data: { tracks: { items: [], total: 0 } } });

    await SpotifyService.searchTracks('tok', 'song', asked);

    expect(axios.get.mock.calls[0][1].params.limit).toBe(sent);
  });

  it('no longer has the methods for removed endpoints', () => {
    expect(SpotifyService.getTracks).toBeUndefined();
    expect(SpotifyService.getAudioFeatures).toBeUndefined();
  });
});
