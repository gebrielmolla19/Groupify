import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AppRail from './AppRail';

vi.mock('../../contexts/UserContext', () => ({
  useUser: () => ({ user: { displayName: 'Maya', profileImage: null } }),
}));
vi.mock('../../hooks/useGroups', () => ({
  useGroups: () => ({
    groups: [
      { _id: 'g1', name: 'Late Night Rotation', members: [{}, {}, {}] },
      { _id: 'g2', name: 'Gym Rats', members: [{}] },
    ],
    createGroup: vi.fn(),
    joinGroupByCode: vi.fn(),
  }),
}));
vi.mock('../../hooks/useChangelogStatus', () => ({ useChangelogStatus: () => ({ hasUnread: false }) }));

function Path() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderRail(compact: boolean, path = '/groups/g1/playlist', onNavigate = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<><AppRail compact={compact} onNavigate={onNavigate} /><Path /></>} />
      </Routes>
    </MemoryRouter>,
  );
  return onNavigate;
}

describe('AppRail', () => {
  it('lists the groups with member counts and marks the current one', () => {
    renderRail(false);
    const groups = screen.getByRole('navigation', { name: 'Groups' });
    expect(groups).toHaveTextContent('Late Night Rotation3 members');
    expect(groups).toHaveTextContent('Gym Rats1 member');
    expect(screen.getByRole('button', { name: /Late Night Rotation/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Gym Rats/ })).not.toHaveAttribute('aria-current');
  });

  it('navigates to a group and reports it', async () => {
    const onNavigate = renderRail(false, '/');
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: /Gym Rats/ }));
    expect(screen.getByTestId('path')).toHaveTextContent('/groups/g2');
    expect(onNavigate).toHaveBeenCalled();
  });

  it('keeps every control named when compact', () => {
    renderRail(true);
    for (const name of ['Home', /Late Night Rotation/, 'New or join group', 'Take the tour', "What's new", 'You']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('Groupify')).toHaveClass('sr-only');
    expect(screen.getByText('Home')).toHaveClass('sr-only');
  });

  it('offers new group and join with a code', async () => {
    renderRail(false);
    await userEvent.click(screen.getByRole('button', { name: 'New or join group' }));
    expect(screen.getByRole('menuitem', { name: 'New group' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Join with a code' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
