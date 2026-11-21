import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import * as sidebarModule from '../ui/sidebar';

vi.mock('../ui/sidebar', async () => {
  const React = await import('react');
  type Ctx = { isMobile: boolean; openMobile: boolean; setOpenMobile: (open: boolean) => void };
  const SidebarCtx = React.createContext<Ctx | null>(null);
  const useSidebar = () => React.useContext(SidebarCtx) as Ctx;
  return {
    useSidebar,
    TestSidebarProvider: ({ isMobile, children }: { isMobile: boolean; children: ReactNode }) => {
      const [openMobile, setOpenMobile] = React.useState(true);
      return <SidebarCtx.Provider value={{ isMobile, openMobile, setOpenMobile }}>{children}</SidebarCtx.Provider>;
    },
  };
});
vi.mock('../../contexts/UserContext', () => ({
  useUser: () => ({ user: { displayName: 'Maya', profileImage: null } }),
}));
const createGroup = vi.fn();
vi.mock('../../hooks/useGroups', () => ({
  useGroups: () => ({ groups: [], createGroup, joinGroupByCode: vi.fn() }),
}));
vi.mock('../../hooks/useChangelogStatus', () => ({ useChangelogStatus: () => ({ hasUnread: false }) }));
vi.mock('../../hooks/useNotifications', () => ({ useNotifications: () => ({ unreadCount: 0 }) }));

const { TestSidebarProvider } = sidebarModule as unknown as {
  TestSidebarProvider: (props: { isMobile: boolean; children: ReactNode }) => JSX.Element;
};
const rail = { width: 240, separatorProps: {} } as unknown as Parameters<typeof AppSidebar>[0]['rail'];

function renderSidebar(isMobile: boolean) {
  render(
    <MemoryRouter>
      <TestSidebarProvider isMobile={isMobile}>
        <AppSidebar rail={rail} />
        <Routes>
          <Route path="/" element={null} />
          <Route path="/groups/:groupId" element={<p>Group feed page</p>} />
        </Routes>
      </TestSidebarProvider>
    </MemoryRouter>,
  );
}

async function openNewOrJoinMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'New or join group' }));
  return screen.getByRole('menu');
}

describe('AppSidebar', () => {
  it('shows the tab bar instead of the rail on phones', () => {
    renderSidebar(true);
    const tabs = screen.getByRole('navigation', { name: 'Main' });
    expect(tabs).toHaveTextContent('HomeGroupsActivityYou');
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New or join group' })).not.toBeInTheDocument();
  });

  it('opens the new-or-join menu beside the desktop rail', async () => {
    renderSidebar(false);
    expect(await openNewOrJoinMenu()).toHaveAttribute('data-side', 'right');
  });

  it.each([
    ['New group', 'Start a group'],
    ['Join with a code', 'Join a group'],
  ])('on desktop, "%s" shows its dialog', async (item, title) => {
    renderSidebar(false);
    await openNewOrJoinMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: item }));
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument();
  });

  it('on desktop, creating a group from the rail opens the new group', async () => {
    createGroup.mockResolvedValueOnce({ _id: 'g-new', name: 'Road trip' });
    renderSidebar(false);
    await openNewOrJoinMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'New group' }));
    await userEvent.type(await screen.findByPlaceholderText('Late Night Rotation'), 'Road trip');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
    expect(await screen.findByText('Group feed page')).toBeInTheDocument();
  });

  it('switches between the create and join dialogs', async () => {
    renderSidebar(false);
    await openNewOrJoinMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'New group' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Have a code? Join instead' }));
    expect(await screen.findByRole('dialog', { name: 'Join a group' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Start a group' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start a new group instead' }));
    expect(await screen.findByRole('dialog', { name: 'Start a group' })).toBeInTheDocument();
  });
});
