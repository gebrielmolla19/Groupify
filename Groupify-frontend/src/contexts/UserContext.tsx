/**
 * User Context
 * Provides authentication state and user data throughout the app
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { getToken, setToken, getCurrentUser, logout as apiLogout, removeToken } from '../lib/api';
import { logger } from '../utils/logger';

interface UserContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getToken();
      if (storedToken) {
        setTokenState(storedToken);
        try {
          await fetchUserData(storedToken);
        } catch (error) {
          // Token might be invalid, clear it
          logger.warn('Token invalid, clearing auth state');
          removeToken();
          setTokenState(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const fetchUserData = async (authToken?: string) => {
    const tokenToUse = authToken || token;
    if (!tokenToUse) {
      throw new Error('No token available');
    }

    try {
      const userData = await getCurrentUser();
      setUser(userData);
      return userData;
    } catch (error) {
      logger.error('Failed to fetch user data:', error);
      throw error;
    }
  };

  const handleLogin = async (newToken: string) => {
    setToken(newToken);
    setTokenState(newToken);
    const userData = await fetchUserData(newToken);
    logger.info('User logged in:', { userId: userData._id, displayName: userData.displayName });
  };

  const handleLogout = async () => {
    // Call backend logout (which also removes token client-side)
    await apiLogout();
    
    logger.info('User logged out');
    
    // Clear state
    setTokenState(null);
    setUser(null);
    
    // Clear URL and go back to root
    window.history.replaceState({}, document.title, '/');
  };

  const handleFetchUser = async () => {
    if (!token) {
      throw new Error('Not authenticated');
    }
    await fetchUserData();
  };

  const value: UserContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login: handleLogin,
    logout: handleLogout,
    fetchUser: handleFetchUser,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

