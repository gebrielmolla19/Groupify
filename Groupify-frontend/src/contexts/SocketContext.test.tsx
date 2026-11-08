import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SocketProvider } from './SocketContext';

const fakeSocket = { on: vi.fn(), disconnect: vi.fn(), connected: false };
vi.mock('socket.io-client', () => ({ io: vi.fn(() => fakeSocket) }));

let userState: { token: string | null; isAuthenticated: boolean } = { token: null, isAuthenticated: false };
vi.mock('./UserContext', () => ({ useUser: () => userState }));

vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { io } = await import('socket.io-client');

describe('SocketProvider', () => {
  beforeEach(() => {
    vi.mocked(io).mockClear();
  });

  it("doesn't connect with a stored token the server hasn't accepted yet", () => {
    userState = { token: 'jwt', isAuthenticated: false };
    render(<SocketProvider>child</SocketProvider>);

    expect(io).not.toHaveBeenCalled();
  });

  it('connects once signed in', () => {
    userState = { token: 'jwt', isAuthenticated: true };
    render(<SocketProvider>child</SocketProvider>);

    expect(io).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ auth: { token: 'jwt' } }));
  });
});
