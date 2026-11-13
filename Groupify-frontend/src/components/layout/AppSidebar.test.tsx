import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import * as sidebarModule from '../ui/sidebar';
import { SHEET_Z_INDEX } from '../ui/sheet';

// A stand-in for the phone sheet that, like the real one, unmounts its
// contents when it closes.
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
    Sidebar: ({ children }: { children: ReactNode }) =>
      useSidebar().openMobile ? <div data-testid="sheet">{children}</div> : null,
  };
});
vi.mock('../../contexts/UserContext', () => ({
  useUser: () => ({ user: { displayName: 'Maya', profileImage: null } }),
}));
vi.mock('../../hooks/useGroups', () => ({
  useGroups: () => ({ groups: [], createGroup: vi.fn(), joinGroupByCode: vi.fn() }),
}));
vi.mock('../../hooks/useChangelogStatus', () => ({ useChangelogStatus: () => ({ hasUnread: false }) }));

const { TestSidebarProvider } = sidebarModule as unknown as {
  TestSidebarProvider: (props: { isMobile: boolean; children: ReactNode }) => JSX.Element;
};
const rail = { width: 240, separatorProps: {} } as unknown as Parameters<typeof AppSidebar>[0]['rail'];

function renderSidebar(isMobile: boolean) {
  render(
    <MemoryRouter>
      <TestSidebarProvider isMobile={isMobile}>
        <AppSidebar rail={rail} />
      </TestSidebarProvider>
    </MemoryRouter>,
  );
}

async function openNewOrJoinMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'New or join group' }));
  return screen.getByRole('menu');
}

describe('AppSidebar', () => {
  it('keeps the phone sheet clear of the status bar and home indicator', () => {
    renderSidebar(true);
    const safeArea = screen.getByTestId('sheet').firstElementChild;
    expect(safeArea).toHaveClass('pt-[env(safe-area-inset-top)]', 'pb-[env(safe-area-inset-bottom)]');
  });

  it('opens the new-or-join menu above the button and stacked over the phone sheet', async () => {
    renderSidebar(true);
    const menu = await openNewOrJoinMenu();
    expect(menu).toHaveAttribute('data-side', 'top');
    expect(Number(menu.style.zIndex)).toBeGreaterThan(SHEET_Z_INDEX);
  });

  it('opens the new-or-join menu beside the desktop rail', async () => {
    renderSidebar(false);
    expect(await openNewOrJoinMenu()).toHaveAttribute('data-side', 'right');
  });

  it.each([
    ['New group', 'Create New Group'],
    ['Join with a code', 'Join a Group'],
  ])('on phones, "%s" closes the sheet and shows its dialog', async (item, title) => {
    renderSidebar(true);
    await openNewOrJoinMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: item }));
    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument();
  });

  it.each([
    ['New group', 'Create New Group'],
    ['Join with a code', 'Join a Group'],
  ])('on desktop, "%s" shows its dialog', async (item, title) => {
    renderSidebar(false);
    await openNewOrJoinMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: item }));
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument();
  });
});
