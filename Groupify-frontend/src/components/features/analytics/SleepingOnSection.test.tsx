import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SleepingOnSection from './SleepingOnSection';
import { useSongsSummary } from '../../../hooks/useSongsSummary';
import { useSpotifyPlayer } from '../../../hooks/useSpotifyPlayer';
import { toast } from 'sonner';
import type { SongsSummary, SongsSummaryShare } from '../../../types/analytics';

vi.mock('../../../hooks/useSongsSummary', () => ({ useSongsSummary: vi.fn() }));
vi.mock('../../../hooks/useSpotifyPlayer', () => ({
  useSpotifyPlayer: vi.fn(),
  wasPlaybackErrorNotified: (err: unknown) => err instanceof Error && err.message === 'already shown',
}));
const group = { _id: 'g1', name: 'Sample group' };
vi.mock('../../../hooks/useGroups', () => ({ useGroups: () => ({ groups: [group] }) }));
const setPlayingGroup = vi.fn();
vi.mock('../../../contexts/PlayingGroupContext', () => ({ usePlayingGroup: () => ({ setPlayingGroup }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const share = (id: string, trackName: string): SongsSummaryShare => ({
  shareId: id,
  spotifyTrackId: `track-${id}`,
  trackName,
  artistName: 'Sample Artist',
  trackImage: null,
  sharedBy: { id: 'u2', displayName: 'Ana' },
  sharedAt: new Date().toISOString(),
});

const summary = (overrides: Partial<SongsSummary> = {}): SongsSummary => ({
  range: '30d',
  sleepingOn: { shares: [share('a', 'Lost Track')], total: 3 },
  sleptOn: { shares: [share('b', 'My Track')], total: 1, others: 2 },
  records: { fastestFullListen: null, mostLiked: null, longestStreak: { days: 4 } },
  ...overrides,
});

const playTrack = vi.fn();
function setPlayer(ready = true) {
  vi.mocked(useSpotifyPlayer).mockReturnValue({
    playTrack,
    deviceId: ready ? 'device' : null,
    isLoading: false,
  } as unknown as ReturnType<typeof useSpotifyPlayer>);
}

function setSummary(state: Partial<ReturnType<typeof useSongsSummary>>) {
  vi.mocked(useSongsSummary).mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...state,
  } as ReturnType<typeof useSongsSummary>);
}

describe('SleepingOnSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPlayer();
  });

  it('plays a share the viewer is sleeping on through the app player', async () => {
    setSummary({ data: summary() });
    render(<SleepingOnSection groupId="g1" range="30d" />);

    await userEvent.click(screen.getByRole('button', { name: 'Play Lost Track by Sample Artist' }));

    expect(setPlayingGroup).toHaveBeenCalledWith(group);
    expect(playTrack).toHaveBeenCalledWith('spotify:track:track-a');
    expect(screen.getByText('And 2 more')).toBeInTheDocument();
  });

  it('says the player is not ready instead of playing', async () => {
    setPlayer(false);
    setSummary({ data: summary() });
    render(<SleepingOnSection groupId="g1" range="30d" />);

    await userEvent.click(screen.getByRole('button', { name: /Play Lost Track/ }));

    expect(playTrack).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('says once when playing fails, unless the player already did', async () => {
    setSummary({ data: summary() });
    render(<SleepingOnSection groupId="g1" range="30d" />);
    const play = screen.getByRole('button', { name: /Play Lost Track/ });

    playTrack.mockRejectedValueOnce(new Error('Spotify is busy'));
    await userEvent.click(play);
    expect(toast.error).toHaveBeenCalledWith('Spotify is busy');

    playTrack.mockRejectedValueOnce(new Error('already shown'));
    await userEvent.click(play);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('shows the nudge stand-in and the records', async () => {
    setSummary({ data: summary() });
    render(<SleepingOnSection groupId="g1" range="30d" />);

    await userEvent.click(screen.getByRole('button', { name: 'Nudge the group about My Track' }));

    expect(toast.info).toHaveBeenCalledWith("Nudges aren't available yet.");
    expect(screen.getByText('4 days')).toBeInTheDocument();
    expect(screen.getByText('No likes in the last 30 days')).toBeInTheDocument();
  });

  it('explains empty lists', () => {
    setSummary({
      data: summary({ sleepingOn: { shares: [], total: 0 }, sleptOn: { shares: [], total: 0, others: 0 } }),
    });
    render(<SleepingOnSection groupId="g1" range="30d" />);

    expect(screen.getByText("You've listened to every share from the others in the last 30 days.")).toBeInTheDocument();
    expect(screen.getByText('Shows once someone else is in the group.')).toBeInTheDocument();
  });

  it('shows a load failure inline with Try again', async () => {
    const refetch = vi.fn();
    setSummary({ error: 'Network down', refetch });
    render(<SleepingOnSection groupId="g1" range="30d" />);

    expect(screen.getByRole('alert')).toHaveTextContent("The songs didn't load.");
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('asks for the range the page passes in', () => {
    setSummary({ data: summary({ range: '7d' }) });
    render(<SleepingOnSection groupId="g1" range="7d" />);

    expect(useSongsSummary).toHaveBeenCalledWith('g1', '7d');
  });
});
