import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PhoneTabBar from './PhoneTabBar';
import { groupIdFromPath } from '../../hooks/useLastGroup';

let groups = [{ _id: 'g1' }, { _id: 'g2' }];
let isLoading = false;
vi.mock('../../hooks/useGroups', () => ({ useGroups: () => ({ groups, isLoading }) }));

function Path() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<><PhoneTabBar /><Path /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const tab = (name: string) => screen.getByRole('button', { name });
const path = () => screen.getByTestId('path').textContent;

describe('PhoneTabBar', () => {
  beforeEach(() => {
    localStorage.clear();
    groups = [{ _id: 'g1' }, { _id: 'g2' }];
    isLoading = false;
  });

  it('shows Home, Groups and You and marks the current tab', () => {
    renderAt('/groups/g2/playlist');
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveTextContent('HomeGroupsYou');
    expect(tab('Groups')).toHaveAttribute('aria-current', 'page');
    expect(tab('Home')).not.toHaveAttribute('aria-current');
  });

  it('Groups goes back to the last group opened', async () => {
    renderAt('/groups/g2/settings');
    await userEvent.click(tab('Home'));
    expect(path()).toBe('/');
    await userEvent.click(tab('Groups'));
    expect(path()).toBe('/groups/g2');
    await userEvent.click(tab('You'));
    expect(path()).toBe('/profile');
    expect(tab('You')).toHaveAttribute('aria-current', 'page');
  });

  it('Groups goes Home when no group was opened yet', async () => {
    renderAt('/profile');
    await userEvent.click(tab('Groups'));
    expect(path()).toBe('/');
  });

  it('Groups trusts the last group while groups are still loading', async () => {
    localStorage.setItem('groupify-last-group', 'g2');
    groups = [];
    isLoading = true;
    renderAt('/');
    await userEvent.click(tab('Groups'));
    expect(path()).toBe('/groups/g2');
  });

  it('Groups goes Home when the last group was left', async () => {
    localStorage.setItem('groupify-last-group', 'gone');
    renderAt('/');
    await userEvent.click(tab('Groups'));
    expect(path()).toBe('/');
  });
});

describe('groupIdFromPath', () => {
  it.each([
    ['/groups/abc', 'abc'],
    ['/groups/abc/playlist', 'abc'],
    ['/', null],
    ['/profile', null],
  ])('%s → %s', (p, id) => expect(groupIdFromPath(p)).toBe(id));
});
