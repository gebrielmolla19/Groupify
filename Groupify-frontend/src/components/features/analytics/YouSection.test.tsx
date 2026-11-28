import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YouSection from './YouSection';
import { animate, useReducedMotion } from 'framer-motion';
import { useViewerSummary } from '../../../hooks/useViewerSummary';
import type { ViewerSummary } from '../../../types/analytics';

vi.mock('../../../hooks/useViewerSummary', () => ({ useViewerSummary: vi.fn() }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  // Real animations, counted so tests can see how often the nudge plays.
  return { ...actual, animate: vi.fn(actual.animate), useReducedMotion: vi.fn(() => false) };
});

// jsdom has no IntersectionObserver or matchMedia. The section counts as on
// screen as soon as it's observed, and the screen is a phone unless a test
// says otherwise.
const observed: Element[] = [];
class InViewObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    observed.push(target);
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
}
let desktop = false;
vi.stubGlobal('IntersectionObserver', InViewObserver);
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: desktop && query.includes('min-width'),
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
}));

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
  beforeEach(() => {
    vi.mocked(useViewerSummary).mockReset();
    localStorage.clear();
    observed.length = 0;
    desktop = false;
    vi.mocked(animate).mockClear();
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });

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

  const slides = () => screen.queryAllByRole('group', { hidden: true }).filter((el) => el.getAttribute('aria-roledescription') === 'slide');
  const topCard = () => slides().find((el) => !el.closest('[aria-hidden="true"]'));
  const announced = () => screen.getByText(/^Card \d of 6/);

  it('stacks the six cards in a deck on a phone, the first on top', () => {
    hook({ data: sample });
    render(<YouSection groupId="g1" />);

    expect(screen.getByRole('region', { name: 'Your numbers' })).toHaveAttribute('aria-roledescription', 'carousel');
    expect(slides()).toHaveLength(6);
    expect(topCard()).toHaveAttribute('aria-label', '1 of 6: Your role');
    expect(announced()).toHaveTextContent('Card 1 of 6: Your role');
  });

  it('moves through the deck with the arrow keys and goes round', async () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    hook({ data: sample });
    render(<YouSection groupId="g1" />);
    const deck = screen.getByRole('region', { name: 'Your numbers' });
    deck.focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(await screen.findByText('Card 2 of 6: Hit rate')).toBeInTheDocument();
    expect(topCard()).toHaveAttribute('aria-label', '2 of 6: Hit rate');

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(await screen.findByText('Card 6 of 6: Your reflex')).toBeInTheDocument();
  });

  it('keeps the grid on desktop', () => {
    desktop = true;
    hook({ data: sample });
    render(<YouSection groupId="g1" />);

    expect(screen.queryByRole('region', { name: 'Your numbers' })).not.toBeInTheDocument();
    expect(slides()).toHaveLength(0);
    expect(screen.getByText('Patient Zero')).toBeVisible();
    expect(screen.getByText('Your reflex')).toBeVisible();
  });

  // The nudge waits for the deck's wrapper to come into view.
  const watchedForNudge = () => {
    const region = screen.getByRole('region', { name: 'Your numbers' });
    return observed.some((target) => target !== region && target.contains(region));
  };

  it('nudges the top card once, then remembers it did', () => {
    hook({ data: sample });
    const { unmount } = render(<YouSection groupId="g1" />);
    expect(watchedForNudge()).toBe(true);
    expect(localStorage.getItem('groupify-you-nudge-seen')).toBe('true');
    unmount();

    observed.length = 0;
    render(<YouSection groupId="g1" />);
    expect(watchedForNudge()).toBe(false);
  });

  const nudges = () =>
    vi.mocked(animate).mock.calls.filter(([, keyframes]) => JSON.stringify(keyframes) === '[0,-48,0]').length;

  it('plays the nudge once, not again when card 1 comes back to the top', async () => {
    hook({ data: sample });
    render(<YouSection groupId="g1" />);
    expect(nudges()).toBe(1);

    screen.getByRole('region', { name: 'Your numbers' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(await screen.findByText('Card 6 of 6: Your reflex')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(await screen.findByText('Card 1 of 6: Your role')).toBeInTheDocument();
    expect(nudges()).toBe(1);
  });

  it('ignores ← while a card is flying off after →', async () => {
    localStorage.setItem('groupify-you-nudge-seen', 'true');
    hook({ data: sample });
    render(<YouSection groupId="g1" />);
    screen.getByRole('region', { name: 'Your numbers' }).focus();

    await userEvent.keyboard('{ArrowRight}{ArrowLeft}');
    expect(await screen.findByText('Card 2 of 6: Hit rate')).toBeInTheDocument();
  });

  it('keeps the same card on top when the period changes', async () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    hook({ data: sample });
    const { rerender } = render(<YouSection groupId="g1" />);
    screen.getByRole('region', { name: 'Your numbers' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(await screen.findByText('Card 6 of 6: Your reflex')).toBeInTheDocument();

    hook({ data: { ...sample, range: '7d' } });
    await userEvent.click(screen.getByRole('radio', { name: '7d' }));
    rerender(<YouSection groupId="g1" />);
    expect(screen.getByText('Card 6 of 6: Your reflex')).toBeInTheDocument();
  });

  it('skips the nudge when reduced motion is on', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    hook({ data: sample });
    render(<YouSection groupId="g1" />);
    expect(watchedForNudge()).toBe(false);
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
