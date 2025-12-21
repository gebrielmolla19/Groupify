const axios = require('axios');
const SpotifyService = require('../src/services/spotifyService');

jest.mock('axios');

describe('SpotifyService.playTrack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to "Groupify Web Player" device when provided deviceId is missing', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        devices: [
          { id: 'abc123', name: 'Groupify Web Player', is_active: false },
          { id: 'other', name: 'Some Phone', is_active: true }
        ]
      }
    });

    axios.put.mockResolvedValueOnce({ data: {} });

    await SpotifyService.playTrack('token', 'stale-device-id', 'spotify:track:123');

    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(axios.put.mock.calls[0][0]).toContain('/me/player/play?device_id=abc123');
  });

  it('on 404 from play, transfers playback then retries play once', async () => {
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

    // First call: play
    expect(axios.put.mock.calls[0][0]).toContain('/me/player/play?device_id=dev1');

    // Second call: transfer
    expect(axios.put.mock.calls[1][0]).toContain('/me/player');
    expect(axios.put.mock.calls[1][1]).toEqual({ device_ids: ['dev1'], play: true });

    // Third call: play retry
    expect(axios.put.mock.calls[2][0]).toContain('/me/player/play?device_id=dev1');
  });
});


