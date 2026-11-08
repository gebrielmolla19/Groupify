import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../lib/config';
import { useUser } from './UserContext';
import { logger } from '../utils/logger';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  joinGroup: (groupId: string) => void;
  leaveGroup: (groupId: string) => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  joinGroup: () => {},
  leaveGroup: () => {},
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { token, isAuthenticated } = useUser();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Disconnect any existing socket before creating a new one
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }

    // Only connect once the server has accepted the token. A stored token
    // is kept through an outage (UserContext), and connecting with it then
    // would just retry against a server that's down.
    if (!token || !isAuthenticated) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      logger.info('Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      logger.error('Socket connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, isAuthenticated]);

  const joinGroup = (groupId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('joinGroup', groupId);
      logger.debug('Joined socket room:', groupId);
    }
  };

  const leaveGroup = (groupId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leaveGroup', groupId);
      logger.debug('Left socket room:', groupId);
    }
  };

  return (
    <SocketContext.Provider
      value={{ socket: socketRef.current, isConnected, joinGroup, leaveGroup }}
    >
      {children}
    </SocketContext.Provider>
  );
}
