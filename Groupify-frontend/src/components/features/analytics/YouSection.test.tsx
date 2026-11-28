import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YouSection from './YouSection';
import { useReducedMotion } from 'framer-motion';
import { useViewerSummary } from '../../../hooks/useViewerSummary';
import type { ViewerSummary } from '../../../types/analytics';

vi.mock('../../../hooks/useViewerSummary', () => ({ useViewerSummary: vi.fn() }));
vi.mock('framer-motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('framer-motion')>()),
  useReducedMotion: vi.fn(() => false),
}));

// jsdom has no layout observers or matchMedia; Embla and framer-motion need them.
class NoopObserver {
  observe(_target?: Element) {}
  unobserve() {}
  disconnect() {}
}
// The section counts as on screen as soon as it's observed.
const observed: Element[] = [];
class InViewObserver extends NoopObserver {
  constructor(private callback: IntersectionObserverCallback) {
    super();
  }
  observe(target: Element) {
    observed.push(target);
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}
vi.stubGlobal('ResizeObserver', NoopObserver);
vi.stubGlobal('IntersectionObserver', InViewObserver);
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
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

  it('puts the six cards in a carousel, each labelled with its place', () => {
    hook({ data: sample });
    render(<YouSection groupId="g1" />);

    const carousel = screen.getByRole('region', { name: 'Your numbers' });
    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
    const slides = screen.getAllByRole('group').filter((el) => el.getAttribute('aria-roledescription') === 'slide');
    expect(slides.map((s) => s.getAttribute('aria-label'))).toEqual([
      '1 of 6: Your role',
      '2 of 6: Hit rate',
      '3 of 6: Sharing streak',
      '4 of 6: Best-landing share',
      '5 of 6: Discovery credit',
      '6 of 6: Your reflex',
    ]);
  });

  // The nudge waits for the whole section (which contains the carousel) to come into view.
  const watchedForNudge = () => {
    const region = screen.getByRole('region', { name: 'Your numbers' });
    return observed.some((target) => target !== region && target.contains(region));
  };
  const cardStyles = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-you-card]')).map((card) => card.style.transform);

  it('nudges the cards once, then remembers it did', () => {
    hook({ data: sample });
    const { unmount } = render(<YouSection groupId="g1" />);
    expect(watchedForNudge()).toBe(true);
    expect(localStorage.getItem('groupify-you-nudge-seen')).toBe('true');
    unmount();

    observed.length = 0;
    render(<YouSection groupId="g1" />);
    expect(watchedForNudge()).toBe(false);
  });

  it('scales the cards as they swipe, unless reduced motion is on', () => {
    hook({ data: sample });
    const { unmount } = render(<YouSection groupId="g1" />);
    expect(cardStyles().every((t) => t.startsWith('scale('))).toBe(true);
    unmount();

    localStorage.clear();
    observed.length = 0;
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(<YouSection groupId="g1" />);
    expect(cardStyles().every((t) => t === '')).toBe(true);
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
