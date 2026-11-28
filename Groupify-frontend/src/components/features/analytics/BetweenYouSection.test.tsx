import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BetweenYouSection from './BetweenYouSection';
import { useBetweenYou } from '../../../hooks/useBetweenYou';
import type { BetweenYou } from '../../../types/analytics';

vi.mock('../../../hooks/useBetweenYou', () => ({ useBetweenYou: vi.fn() }));

const ana = { userId: 'ana', displayName: 'Sample Ana', profileImage: null };
const bo = { userId: 'bo', displayName: 'Sample Bo', profileImage: null };

const sample: BetweenYou = {
  range: '30d',
  members: [ana, bo],
  pair: {
    member: 'ana',
    theirShares: 4,
    youLiked: 3,
    yourShares: 5,
    theyLiked: 1,
    verdict: { id: 'one_sided', leaning: 'you' },
    previousVerdict: { id: 'common_ground' },
  },
  biggestFan: { members: ['bo'], listens: 4, likes: 2, yourShares: 5 },
  tastemaker: { members: ['ana'], liked: 3, shares: 4 },
};

const hook = (state: Partial<ReturnType<typeof useBetweenYou>>) =>
  vi.mocked(useBetweenYou).mockReturnValue({ data: null, isLoading: false, error: null, errorStatus: null, refetch: vi.fn(), ...state });

describe('BetweenYouSection', () => {
  beforeEach(() => vi.mocked(useBetweenYou).mockReset());

  it('shows the pair, biggest fan and tastemaker', () => {
    hook({ data: sample });
    render(<BetweenYouSection groupId="g1" range="30d" />);

    expect(screen.getByText('One-sided')).toBeInTheDocument();
    expect(screen.getByText('You liked 3 of Sample Ana\'s 4 shares')).toBeInTheDocument();
    expect(screen.getByText('Sample Ana liked 1 of your 5 shares')).toBeInTheDocument();
    expect(screen.getByText('Previous 30 days: Common ground')).toBeInTheDocument();
    expect(screen.getByText('Listened to 4 and liked 2 of your 5 shares.')).toBeInTheDocument();
    expect(screen.getByText('You liked 3 of Sample Ana\'s 4 shares.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Member to compare with' })).toBeInTheDocument();
  });

  it('shows the one other member without a picker in a 2-member group', () => {
    hook({ data: { ...sample, members: [ana], biggestFan: null, tastemaker: null } });
    render(<BetweenYouSection groupId="g1" range="30d" />);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Sample Ana')).toBeInTheDocument();
    expect(screen.getByText('No one has listened to or liked your shares in this period yet.')).toBeInTheDocument();
    expect(screen.getByText(/Shows once you like shares from someone/)).toBeInTheDocument();
  });

  it('says so when the viewer is the only member', () => {
    hook({ data: { ...sample, members: [], pair: null, biggestFan: null, tastemaker: null } });
    render(<BetweenYouSection groupId="g1" range="30d" />);

    expect(screen.getByText('Between you shows once someone else joins the group.')).toBeInTheDocument();
  });

  it('keeps the server\'s pair when the page\'s period changes', () => {
    hook({ data: sample });
    const { rerender } = render(<BetweenYouSection groupId="g1" range="30d" />);

    rerender(<BetweenYouSection groupId="g1" range="7d" />);

    expect(useBetweenYou).toHaveBeenLastCalledWith('g1', '7d', 'ana');
  });

  it('shows a failed load inline, with Try again', async () => {
    const refetch = vi.fn();
    hook({ error: 'Server error', errorStatus: 500, refetch });
    render(<BetweenYouSection groupId="g1" range="30d" />);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Between you didn\'t load.');
    expect(refetch).toHaveBeenCalled();
  });
});
