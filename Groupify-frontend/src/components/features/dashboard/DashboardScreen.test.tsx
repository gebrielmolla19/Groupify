import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DashboardScreen from './DashboardScreen';

const createGroup = vi.fn();
vi.mock('../../../hooks/useGroups', () => ({
  useGroups: () => ({ groups: [], isLoading: false, error: null, createGroup, joinGroupByCode: vi.fn() }),
}));
// The notifications menu fetches on mount; it isn't part of this flow.
vi.mock('../notifications/NotificationsDropdown', () => ({ default: () => null }));

describe('DashboardScreen', () => {
  // Phones have no rail, so the dashboard is where they create a group (#68).
  it('opens the new group after creating it', async () => {
    createGroup.mockResolvedValueOnce({ _id: 'g-new', name: 'Road trip' });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/groups/:groupId" element={<p>Group feed page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create new group' }));
    await userEvent.type(await screen.findByPlaceholderText('Enter group name'), 'Road trip');
    await userEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    expect(await screen.findByText('Group feed page')).toBeInTheDocument();
  });
});
