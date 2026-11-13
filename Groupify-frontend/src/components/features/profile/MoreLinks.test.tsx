import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MoreLinks from './MoreLinks';

let hasUnread = false;
vi.mock('../../../hooks/useChangelogStatus', () => ({ useChangelogStatus: () => ({ hasUnread }) }));
const startTour = vi.fn();
vi.mock('../onboarding/OnboardingWalkthrough', () => ({ startTour: () => startTour() }));

function Path() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderLinks() {
  render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="*" element={<><MoreLinks /><Path /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MoreLinks', () => {
  it('starts the tour and opens What\'s new', async () => {
    renderLinks();
    await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(startTour).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: "What's new" }));
    expect(screen.getByTestId('path')).toHaveTextContent('/changelog');
  });

  it('says when What\'s new has unread entries', () => {
    hasUnread = true;
    renderLinks();
    expect(screen.getByRole('button', { name: /What's new\s*\(unread\)/ })).toBeInTheDocument();
  });
});
