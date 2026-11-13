import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SpotifyPlayerCard from './SpotifyPlayerCard';

// Radix Slider measures itself with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const player = { togglePlay: vi.fn(() => Promise.resolve()), activateElement: vi.fn(() => Promise.resolve()), seek: vi.fn(), nextTrack: vi.fn(() => Promise.resolve()), previousTrack: vi.fn(() => Promise.resolve()) };
const track = {
  uri: 'spotify:track:t1',
  name: 'Glue',
  artists: [{ name: 'Bicep', uri: 'spotify:artist:a1' }],
  album: { name: 'Bicep', uri: '', images: [{ url: 'https://example.com/art.jpg' }] },
};

let spotify: Record<string, unknown>;
let isMobile = false;

vi.mock('../../../hooks/useSpotifyPlayer', () => ({
  useSpotifyPlayer: () => spotify,
  wasPlaybackErrorNotified: () => false,
}));
vi.mock('../../../hooks/useCurrentPlayback', () => ({ useCurrentPlayback: () => ({ playback: null }) }));
vi.mock('../../../contexts/PlayingGroupContext', () => ({
  usePlayingGroup: () => ({ playingGroup: null, setPlayingGroup: vi.fn(), sortBy: 'recent' }),
}));
vi.mock('../../../hooks/usePlaylist', () => ({ usePlaylist: () => ({ shares: [] }) }));
vi.mock('../../../hooks/useGroups', () => ({ useGroups: () => ({ groups: [] }) }));
vi.mock('../../ui/sidebar', () => ({ useSidebar: () => ({ isMobile }) }));

function renderPlayer() {
  render(
    <MemoryRouter>
      <SpotifyPlayerCard />
    </MemoryRouter>,
  );
  return screen.getByTestId('spotify-player');
}

describe('SpotifyPlayerCard', () => {
  beforeEach(() => {
    isMobile = false;
    vi.clearAllMocks();
    spotify = {
      player, currentTrack: track, isPlaying: true, position: 60_000, duration: 240_000,
      isLoading: false, error: null, deviceId: 'web', deviceReadyTimestamp: null, playTrack: vi.fn(),
    };
  });

  it('on desktop, is a full-width bar with the song, controls, scrubber and device', () => {
    const bar = renderPlayer();
    expect(bar.tagName).toBe('FOOTER');
    expect(bar).toHaveTextContent('Glue');
    expect(bar).toHaveTextContent('Bicep');
    expect(bar).toHaveTextContent('Playing in this browser');
    for (const name of ['Previous track', 'Pause', 'Next track', 'Select playback device']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('on phones, is a mini player with previous, play and next together, and no device picker or seek', () => {
    isMobile = true;
    const bar = renderPlayer();
    expect(bar.tagName).toBe('SECTION');
    expect(bar).toHaveTextContent('Glue');
    const controls = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(controls).toEqual(['Previous track', 'Pause', 'Next track']);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('play/pause unlocks audio in the same tap, then toggles the in-browser player', async () => {
    renderPlayer();
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(player.activateElement).toHaveBeenCalled();
    expect(player.togglePlay).toHaveBeenCalled();
  });

  it.each([
    ['loading', { isLoading: true, currentTrack: null }, 'Connecting to Spotify…'],
    ['error', { error: 'Premium required', currentTrack: null }, 'Player error'],
    ['no device', { deviceId: null, currentTrack: null }, 'No player connected'],
    ['no track', { currentTrack: null }, 'Ready to play'],
  ])('shows a status line when %s', (_, state, title) => {
    Object.assign(spotify, state);
    const bar = renderPlayer();
    expect(bar).toHaveTextContent(title);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('disables the controls until the player is ready', () => {
    Object.assign(spotify, { deviceId: null, currentTrack: null });
    renderPlayer();
    for (const name of ['Previous track', 'Play', 'Next track', 'Select playback device']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });
});
