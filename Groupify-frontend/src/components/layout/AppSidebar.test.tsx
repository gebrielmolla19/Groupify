import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AppSidebar from './AppSidebar';

const sidebar = vi.hoisted(() => ({ isMobile: true, setOpenMobile: vi.fn() }));

vi.mock('../ui/sidebar', () => ({
  Sidebar: ({ children }: { children: ReactNode }) => <div data-testid="sheet">{children}</div>,
  useSidebar: () => sidebar,
}));
vi.mock('../../contexts/UserContext', () => ({
  useUser: () => ({ user: { displayName: 'Maya', profileImage: null } }),
}));
vi.mock('../../hooks/useGroups', () => ({
  useGroups: () => ({ groups: [], createGroup: vi.fn(), joinGroupByCode: vi.fn() }),
}));
vi.mock('../../hooks/useChangelogStatus', () => ({ useChangelogStatus: () => ({ hasUnread: false }) }));

const rail = { width: 240, separatorProps: {} } as unknown as Parameters<typeof AppSidebar>[0]['rail'];

function renderSidebar() {
  render(
    <MemoryRouter>
      <AppSidebar rail={rail} />
    </MemoryRouter>,
  );
}

async function openNewOrJoinMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'New or join group' }));
  return screen.getByRole('menu');
}

describe('AppSidebar', () => {
  beforeEach(() => {
    sidebar.isMobile = true;
  });

  it('keeps the phone sheet clear of the status bar and home indicator', () => {
    renderSidebar();
    const safeArea = screen.getByTestId('sheet').firstElementChild;
    expect(safeArea).toHaveClass('pt-[env(safe-area-inset-top)]', 'pb-[env(safe-area-inset-bottom)]');
  });

  it('opens the new-or-join menu above the button on phones, where there is no room to the right', async () => {
    renderSidebar();
    expect(await openNewOrJoinMenu()).toHaveAttribute('data-side', 'top');
  });

  it('opens the new-or-join menu beside the desktop rail', async () => {
    sidebar.isMobile = false;
    renderSidebar();
    expect(await openNewOrJoinMenu()).toHaveAttribute('data-side', 'right');
  });
});
