const axios = require('axios');
const SpotifyService = require('../src/services/spotifyService');

jest.mock('axios');

describe('SpotifyService.playTrack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('plays directly with the provided deviceId (no upfront device discovery)', async () => {
    axios.put.mockResolvedValueOnce({ data: {} });

    await SpotifyService.playTrack('token', 'my-device-id', 'spotify:track:123');

    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(axios.put.mock.calls[0][0]).toContain('/me/player/play?device_id=my-device-id');
    // No GET call for device discovery
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('on 404 from play, discovers devices, transfers, then retries', async () => {
    // Device discovery returns a device
    axios.get.mockResolvedValueOnce({
      data: {
        devices: [{ id: 'dev1', name: 'Groupify Web Player', is_active: false }]
      }
    });

    const play404 = new Error('No active device found');
    play404.response = {
      status: 404,
      data: { error: { message: 'No active device found', reason: 'NO_ACTIVE_DEVICE' } },
      headers: {}
    };

    // 1) playOnce -> 404
    // 2) transferPlayback -> ok
    // 3) playOnce retry -> ok
    axios.put
      .mockRejectedValueOnce(play404)
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: {} });

    await SpotifyService.playTrack('token', 'dev1', 'spotify:track:456');

    expect(axios.put).toHaveBeenCalledTimes(3);

    // First call: play attempt
    expect(axios.put.mock.calls[0][0]).toContain('/me/player/play?device_id=dev1');

    // Second call: transfer
    expect(axios.put.mock.calls[1][0]).toContain('/me/player');
    expect(axios.put.mock.calls[1][1]).toEqual({ device_ids: ['dev1'], play: true });

    // Third call: play retry
    expect(axios.put.mock.calls[2][0]).toContain('/me/player/play?device_id=dev1');
  });

  it('on 404 from play, falls back to Groupify Web Player device if original not found', async () => {
    // Device discovery returns a different device
    axios.get.mockResolvedValueOnce({
      data: {
        devices: [
          { id: 'web-player-id', name: 'Groupify Web Player', is_active: false },
          { id: 'phone', name: 'My Phone', is_active: true }
        ]
      }
    });

    const play404 = new Error('No active device found');
    play404.response = { status: 404, data: { error: { message: 'Not found' } }, headers: {} };

    axios.put
      .mockRejectedValueOnce(play404)       // play with stale ID -> 404
      .mockResolvedValueOnce({ data: {} })   // transfer to web-player-id
      .mockResolvedValueOnce({ data: {} });  // retry play on web-player-id

    await SpotifyService.playTrack('token', 'stale-id', 'spotify:track:789');

    // Transfer should use the discovered Groupify Web Player device
    expect(axios.put.mock.calls[1][1]).toEqual({ device_ids: ['web-player-id'], play: true });
    // Retry play should also use it
    expect(axios.put.mock.calls[2][0]).toContain('/me/player/play?device_id=web-player-id');
  });
});

describe('SpotifyService.transferPlayback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('transfers playback successfully', async () => {
    axios.put.mockResolvedValueOnce({ data: {} });

    await SpotifyService.transferPlayback('token', 'device-1', true);

    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(axios.put.mock.calls[0][0]).toContain('/me/player');
    expect(axios.put.mock.calls[0][1]).toEqual({ device_ids: ['device-1'], play: true });
  });

  it('returns gracefully on 404 (no active playback)', async () => {
    const err404 = new Error('Not found');
    err404.response = { status: 404, data: { error: { message: 'Not found' } } };
    axios.put.mockRejectedValueOnce(err404);

    const result = await SpotifyService.transferPlayback('token', 'device-1', false);

    expect(result).toEqual({ activated: true, noPlayback: true });
  });

  it('throws on 403 (Premium required)', async () => {
    const err403 = new Error('Forbidden');
    err403.response = { status: 403, data: { error: { message: 'Premium required' } } };
    axios.put.mockRejectedValueOnce(err403);

    await expect(SpotifyService.transferPlayback('token', 'device-1'))
      .rejects.toThrow('Insufficient permissions');
  });
});

describe('SpotifyService.pausePlayback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pauses playback on the active device', async () => {
    axios.put.mockResolvedValueOnce({ data: {} });

    await SpotifyService.pausePlayback('token');

    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(axios.put.mock.calls[0][0]).toContain('/me/player/pause');
    expect(axios.put.mock.calls[0][0]).not.toContain('device_id');
  });

  it('pauses playback on a specific device', async () => {
    axios.put.mockResolvedValueOnce({ data: {} });

    await SpotifyService.pausePlayback('token', 'device-1');

    expect(axios.put.mock.calls[0][0]).toContain('/me/player/pause?device_id=device-1');
  });

  it('silently ignores 403 (already paused)', async () => {
    const err403 = new Error('Forbidden');
    err403.response = { status: 403, data: { error: { message: 'Already paused' } } };
    axios.put.mockRejectedValueOnce(err403);

    // Should not throw
    await SpotifyService.pausePlayback('token');
  });

  it('throws on 404 (no active device)', async () => {
    const err404 = new Error('Not found');
    err404.response = { status: 404, data: { error: { message: 'No device' } } };
    axios.put.mockRejectedValueOnce(err404);

    await expect(SpotifyService.pausePlayback('token'))
      .rejects.toThrow('No active device found');
  });
});

describe('SpotifyService.resumePlayback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resumes playback on the active device (no body)', async () => {
    axios.put.mockResolvedValueOnce({ data: {} });

    await SpotifyService.resumePlayback('token');

    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(axios.put.mock.calls[0][0]).toContain('/me/player/play');
    // Resume sends empty body (no uris), unlike playTrack
    expect(axios.put.mock.calls[0][1]).toEqual({});
  });

  it('resumes on a specific device', async () => {
    axios.put.mockResolvedValueOnce({ data: {} });

    await SpotifyService.resumePlayback('token', 'device-2');

    expect(axios.put.mock.calls[0][0]).toContain('/me/player/play?device_id=device-2');
  });

  it('throws on 404 (no active device)', async () => {
    const err404 = new Error('Not found');
    err404.response = { status: 404, data: { error: { message: 'No device' } } };
    axios.put.mockRejectedValueOnce(err404);

    await expect(SpotifyService.resumePlayback('token'))
      .rejects.toThrow('No active device found');
  });
});

describe('SpotifyService.skipToNext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips to next track on active device', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });

    await SpotifyService.skipToNext('token');

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toContain('/me/player/next');
  });

  it('skips to next on a specific device', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });

    await SpotifyService.skipToNext('token', 'device-3');

    expect(axios.post.mock.calls[0][0]).toContain('/me/player/next?device_id=device-3');
  });

  it('throws on 404', async () => {
    const err404 = new Error('Not found');
    err404.response = { status: 404, data: { error: { message: 'No device' } } };
    axios.post.mockRejectedValueOnce(err404);

    await expect(SpotifyService.skipToNext('token'))
      .rejects.toThrow('No active device found');
  });
});

describe('SpotifyService.skipToPrevious', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips to previous track on active device', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });

    await SpotifyService.skipToPrevious('token');

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toContain('/me/player/previous');
  });

  it('skips to previous on a specific device', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });

    await SpotifyService.skipToPrevious('token', 'device-4');

    expect(axios.post.mock.calls[0][0]).toContain('/me/player/previous?device_id=device-4');
  });

  it('throws on 404', async () => {
    const err404 = new Error('Not found');
    err404.response = { status: 404, data: { error: { message: 'No device' } } };
    axios.post.mockRejectedValueOnce(err404);

    await expect(SpotifyService.skipToPrevious('token'))
      .rejects.toThrow('No active device found');
  });
});
