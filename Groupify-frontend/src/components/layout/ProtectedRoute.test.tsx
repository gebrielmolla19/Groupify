import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const retryAuth = vi.fn();
const logout = vi.fn();
let userState: Record<string, unknown> = {};

vi.mock('../../contexts/UserContext', () => ({
  useUser: () => userState,
}));

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <p>Dashboard</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a retry screen, not the login page, when the session could not be checked', async () => {
    userState = {
      isAuthenticated: false,
      isLoading: false,
      token: 'jwt',
      authError: 'Network error: Unable to reach the server.',
      retryAuth,
      logout,
    };
    renderAt();

    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
    expect(screen.getByText('Network error: Unable to reach the server.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retryAuth).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(logout).toHaveBeenCalled();
  });

  it('redirects to login when there is no session', () => {
    userState = { isAuthenticated: false, isLoading: false, token: null, authError: null, retryAuth, logout };
    renderAt();

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders the page when signed in', () => {
    userState = { isAuthenticated: true, isLoading: false, token: 'jwt', authError: null, retryAuth, logout };
    renderAt();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
