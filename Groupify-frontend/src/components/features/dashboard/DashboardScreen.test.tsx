import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DashboardScreen from './DashboardScreen';

const createGroup = vi.fn();
const refetchGroups = vi.fn();
const groupsState = vi.hoisted(() => ({ error: null as string | null }));
vi.mock('../../../hooks/useGroups', () => ({
  useGroups: () => ({ groups: [], isLoading: false, error: groupsState.error, refetch: refetchGroups, createGroup, joinGroupByCode: vi.fn() }),
}));
vi.mock('../../../hooks/useUnheardShares', () => ({
  useUnheardShares: () => ({
    data: { shares: [], total: 0, newThisWeek: 0, byGroup: {}, oldestAt: null },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

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
  await userEvent.type(await screen.findByPlaceholderText('Late Night Rotation'), name);
  await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
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
    expect(await screen.findByRole('dialog', { name: 'Start a group' })).toBeInTheDocument();
    expect(screen.queryByText('Group feed page')).not.toBeInTheDocument();
  });

  it('explains how groups work when the user has none', () => {
    groupsState.error = null;
    renderDashboard();
    expect(screen.getByRole('heading', { level: 1, name: 'Start your first group' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join with a code' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('offers to retry when the groups fail to load', async () => {
    groupsState.error = 'Network error';
    renderDashboard();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load your groups.");
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetchGroups).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Start your first group' })).not.toBeInTheDocument();
    groupsState.error = null;
  });
});
