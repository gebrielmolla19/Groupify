import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginScreen from './LoginScreen';
import { login } from '../../../lib/api';

vi.mock('../../../lib/api', () => ({ login: vi.fn() }));

function renderLogin(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LoginScreen />
    </MemoryRouter>,
  );
}

describe('LoginScreen', () => {
  beforeEach(() => vi.mocked(login).mockClear());

  it('draws seven decorative rings, staggered 5s apart, with the third in the text tone', () => {
    renderLogin();
    const layer = screen.getByTestId('login-rings');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    const rings = Array.from(layer.querySelectorAll<HTMLElement>('.login-ring'));
    expect(rings).toHaveLength(7);
    expect(rings.map((r) => r.style.animationDelay)).toEqual(['0s', '-5s', '-10s', '-15s', '-20s', '-25s', '-30s']);
    expect(rings.map((r) => r.dataset.tone)).toEqual(['iris', 'iris', 'text', 'iris', 'iris', 'iris', 'iris']);
  });

  it('starts the Spotify login, passing the app index from the URL', async () => {
    const user = userEvent.setup();
    renderLogin('/login?app=2');
    await user.click(screen.getByRole('button', { name: 'Continue with Spotify' }));
    expect(login).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: 'Connecting to Spotify…' })).toBeDisabled();
  });
});
