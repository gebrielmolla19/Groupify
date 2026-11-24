import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YouSection from './YouSection';
import { useViewerSummary } from '../../../hooks/useViewerSummary';
import type { ViewerSummary } from '../../../types/analytics';

vi.mock('../../../hooks/useViewerSummary', () => ({ useViewerSummary: vi.fn() }));

const MIN = 60_000;
const sample: ViewerSummary = {
  range: '30d',
  role: { id: 'patient_zero', title: 'Patient Zero', reason: 'You brought 6 artists to the group first.' },
  previousRole: { id: 'sharer', title: 'Sharer' },
  hitRate: { hits: 7, total: 9 },
  streak: { longest: 5, record: 6 },
  bestShare: { shareId: 's1', trackName: 'Sample Track', artistName: 'Sample Artist', listens: 4, likes: 3, others: 4 },
  discovery: { artists: 6, resharedByOthers: 2 },
  reflex: { youPlayMs: 6 * MIN, groupPlayMs: 180 * MIN, yoursPlayedMs: 42 * MIN, groupYoursPlayedMs: 300 * MIN },
};

const hook = (state: Partial<ReturnType<typeof useViewerSummary>>) =>
  vi.mocked(useViewerSummary).mockReturnValue({ data: null, isLoading: false, error: null, refetch: vi.fn(), ...state });

describe('YouSection', () => {
  beforeEach(() => vi.mocked(useViewerSummary).mockReset());

  it('shows the viewer\'s role, hit rate, streak, best share, discovery and reflex', () => {
    hook({ data: sample });
    render(<YouSection groupId="g1" />);

    expect(screen.getByText('Patient Zero')).toBeInTheDocument();
    expect(screen.getByText('Previous 30 days: Sharer')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('7 of your 9 shares were listened to by everyone.')).toBeInTheDocument();
    expect(screen.getByText('5 days')).toBeInTheDocument();
    expect(screen.getByText('Sample Artist · all 4 listened, 3 of 4 liked')).toBeInTheDocument();
    expect(screen.getByText('6 min')).toBeInTheDocument();
    expect(screen.getByText('Group typical: 3 hr')).toBeInTheDocument();
  });

  it('asks for the chosen period', async () => {
    hook({ data: sample });
    render(<YouSection groupId="g1" />);

    expect(useViewerSummary).toHaveBeenLastCalledWith('g1', '30d');
    await userEvent.click(screen.getByRole('radio', { name: '7d' }));
    expect(useViewerSummary).toHaveBeenLastCalledWith('g1', '7d');
  });

  it('shows the empty wording when nothing has landed yet', () => {
    hook({
      data: {
        ...sample,
        role: { id: 'quiet', title: 'Quiet', reason: 'No shares or listens from you in this period.' },
        previousRole: null,
        hitRate: null,
        streak: { longest: 0, record: 0 },
        bestShare: null,
        discovery: { artists: 0, resharedByOthers: 0 },
        reflex: { youPlayMs: null, groupPlayMs: null, yoursPlayedMs: null, groupYoursPlayedMs: null },
      },
    });
    render(<YouSection groupId="g1" />);

    expect(screen.getByText('Shows once someone else is in the group.')).toBeInTheDocument();
    expect(screen.getByText('Shows once there are listens to compare.')).toBeInTheDocument();
    expect(screen.queryByText(/Previous/)).not.toBeInTheDocument();
  });

  it('offers to try again when the numbers fail to load', async () => {
    const refetch = vi.fn();
    hook({ error: 'Server error', refetch });
    render(<YouSection groupId="g1" />);

    expect(screen.getByRole('alert')).toHaveTextContent("Your numbers didn't load.");
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });
});
