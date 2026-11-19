import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DashboardScreen from './DashboardScreen';

const createGroup = vi.fn();
vi.mock('../../../hooks/useGroups', () => ({
  useGroups: () => ({ groups: [], isLoading: false, error: null, createGroup, joinGroupByCode: vi.fn() }),
}));
vi.mock('../../../hooks/useUnheardShares', () => ({
  useUnheardShares: () => ({ data: null, isLoading: false, error: null, refetch: vi.fn() }),
}));
// The notifications menu fetches on mount; it isn't part of this flow.

function renderDashboard() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DashboardScreen />} />
        <Route path="/groups/:groupId" element={<p>Group feed page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitNewGroup(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Create new group' }));
  await userEvent.type(await screen.findByPlaceholderText('Enter group name'), name);
  await userEvent.click(screen.getByRole('button', { name: 'Create Group' }));
}

describe('DashboardScreen', () => {
  // Phones have no rail, so the dashboard is where they create a group (#68).
  it('opens the new group after creating it', async () => {
    createGroup.mockResolvedValueOnce({ _id: 'g-new', name: 'Road trip' });
    renderDashboard();
    await submitNewGroup('Road trip');
    expect(await screen.findByText('Group feed page')).toBeInTheDocument();
  });

  it('stays on the dashboard with the dialog open when creating fails', async () => {
    createGroup.mockRejectedValueOnce(new Error('Server error'));
    renderDashboard();
    await submitNewGroup('Road trip');
    expect(await screen.findByRole('dialog', { name: 'Create New Group' })).toBeInTheDocument();
    expect(screen.queryByText('Group feed page')).not.toBeInTheDocument();
  });
});
