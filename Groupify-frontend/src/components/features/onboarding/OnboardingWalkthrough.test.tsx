import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import OnboardingWalkthrough, { startTour } from './OnboardingWalkthrough';
import { useGroups } from '../../../hooks/useGroups';

vi.mock('../../../hooks/useGroups', () => ({ useGroups: vi.fn() }));
vi.mock('../../ui/use-mobile', () => ({ useIsMobile: () => false }));

const KEY = 'groupify_tour_completed';

function setGroups(groups: { _id: string }[], isLoading = false) {
  vi.mocked(useGroups).mockReturnValue({ groups, isLoading } as unknown as ReturnType<typeof useGroups>);
}

function Where() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

function renderTour(path = '/groups/g1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
      <OnboardingWalkthrough />
    </MemoryRouter>,
  );
}

const tour = () => screen.findByRole('dialog', {}, { timeout: 2000 });

describe('OnboardingWalkthrough', () => {
  beforeEach(() => {
    localStorage.clear();
    setGroups([{ _id: 'g1' }]);
  });
  afterEach(() => document.body.querySelectorAll('[data-tour]').forEach((el) => el.remove()));

  it('opens on first run and walks through four steps to Done', async () => {
    const user = userEvent.setup();
    renderTour();
    const dialog = await tour();
    expect(dialog).toHaveAccessibleName('Share a song here');
    expect(dialog).toHaveTextContent('1 of 4');
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('A dot means unheard');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Share a song here');

    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('4 of 4');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Everything about one song');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe('true');
  });

  it('waits for a group before opening by itself, since every step is on the feed', async () => {
    setGroups([]);
    const { rerender } = renderTour('/');
    await new Promise((r) => setTimeout(r, 800));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    setGroups([{ _id: 'g1' }]);
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
        <OnboardingWalkthrough />
      </MemoryRouter>,
    );
    await tour();
    expect(screen.getByTestId('path')).toHaveTextContent('/groups/g1');
  });

  it('stays on the group feed that is already open', async () => {
    setGroups([{ _id: 'g1' }, { _id: 'g2' }]);
    renderTour('/groups/g2');
    await tour();
    expect(screen.getByTestId('path')).toHaveTextContent('/groups/g2');
  });

  it('does not open by itself once completed, and Skip or Escape close it', async () => {
    localStorage.setItem(KEY, 'true');
    const user = userEvent.setup();
    renderTour();
    await new Promise((r) => setTimeout(r, 800));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => startTour());
    await tour();
    expect(localStorage.getItem(KEY)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe('true');

    act(() => startTour());
    await tour();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('spotlights the visible target with padding, and skips hidden copies', async () => {
    const hidden = document.createElement('span');
    hidden.dataset.tour = 'share-input';
    const shown = document.createElement('div');
    shown.dataset.tour = 'share-input';
    document.body.append(hidden, shown);
    hidden.getClientRects = () => [] as unknown as DOMRectList;
    shown.getClientRects = () => [{}] as unknown as DOMRectList;
    shown.scrollIntoView = vi.fn();
    shown.getBoundingClientRect = () => ({ left: 300, top: 100, width: 600, height: 44, right: 900, bottom: 144 }) as DOMRect;

    renderTour();
    await tour();
    const spotlight = await screen.findByTestId('tour-spotlight');
    expect(spotlight).toHaveStyle({ left: '294px', top: '94px', width: '612px', height: '56px' });
  });

  it('steps aside while a modal is open, and Escape is left to the modal', async () => {
    const user = userEvent.setup();
    renderTour();
    await tour();
    const sheet = document.createElement('div');
    sheet.setAttribute('role', 'dialog');
    sheet.dataset.state = 'open';
    sheet.dataset.tour = 'modal';
    document.body.append(sheet);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Share a song here' })).not.toBeInTheDocument());
    await user.keyboard('{Escape}');
    sheet.remove();
    expect(await screen.findByRole('dialog', { name: 'Share a song here' })).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('without a group, points Home to creating or joining one and opens the tour once there is one', async () => {
    setGroups([]);
    const user = userEvent.setup();
    const { rerender } = renderTour('/activity');
    act(() => startTour());
    const card = await tour();
    expect(card).toHaveAccessibleName('Start with a group');
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/);
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();

    setGroups([{ _id: 'g1' }]);
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
        <OnboardingWalkthrough />
      </MemoryRouter>,
    );
    expect(await tour()).toHaveAccessibleName('Share a song here');
  });

  it('shows the card alone when the step has nothing on screen', async () => {
    renderTour();
    await tour();
    expect(screen.queryByTestId('tour-spotlight')).not.toBeInTheDocument();
  });
});
