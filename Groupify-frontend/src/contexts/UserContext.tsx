/**
 * User Context
 * Provides authentication state and user data throughout the app
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { getToken, setToken, getCurrentUser, logout as apiLogout, removeToken } from '../lib/api';
import { isApiError } from '../lib/apiError';
import { registerServiceWorker, requestPermissionAndSubscribe } from '../lib/pushNotifications';
import { logger } from '../utils/logger';

interface UserContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Set when a stored token exists but the session couldn't be checked
   * (server unreachable or failing). The token is kept; call retryAuth.
   */
  authError: string | null;
  retryAuth: () => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

const SESSION_CHECK_FAILED = "Couldn't load your account. Try again in a moment.";

/** The server looked at the token and refused it. Anything else says nothing about the token. */
const isTokenRejected = (error: unknown): boolean =>
  isApiError(error) && (error.status === 401 || error.status === 403);

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check the stored token with the server. Only a 401/403 means the token
  // is bad. A network error or server failure leaves it in place, so a
  // backend outage doesn't sign the user out.
  const loadStoredSession = async () => {
    const storedToken = getToken();
    if (storedToken) {
      setTokenState(storedToken);
      try {
        await fetchUserData(storedToken);
        setAuthError(null);
        // Re-register SW for returning users (non-blocking, no permission prompt — must come from user gesture)
        registerServiceWorker().catch(() => {});
      } catch (error) {
        if (isTokenRejected(error)) {
          logger.warn('Stored token rejected, clearing auth state', {
            status: isApiError(error) ? error.status : undefined,
          });
          removeToken();
          setTokenState(null);
          setUser(null);
          setAuthError(null);
        } else {
          setAuthError(isApiError(error) && error.isNetworkError ? error.message : SESSION_CHECK_FAILED);
        }
      }
    }
    setIsLoading(false);
  };

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    loadStoredSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const retryAuth = async () => {
    setIsLoading(true);
    await loadStoredSession();
  };

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
      if (isApiError(error) && error.isNetworkError) {
        // Expected when the server is down: callers show it to the user.
        logger.warn('Could not fetch user data - server unreachable');
      } else {
        logger.error('Failed to fetch user data:', error);
      }
      throw error;
    }
  };

  const handleLogin = async (newToken: string) => {
    setToken(newToken);
    setTokenState(newToken);
    const userData = await fetchUserData(newToken);
    logger.info('User logged in:', { userId: userData._id, displayName: userData.displayName });

    // Register service worker and request push permission (non-blocking)
    registerServiceWorker().then(() => requestPermissionAndSubscribe()).catch(() => {});
  };

  const handleLogout = async () => {
    // Tell the Spotify player to disconnect so "Groupify Web Player" leaves
    // the user's Spotify Connect device list. An event (rather than an
    // import) avoids a circular dependency: useSpotifyPlayer imports this
    // context. Must match SPOTIFY_LOGOUT_EVENT in hooks/useSpotifyPlayer.ts.
    window.dispatchEvent(new Event('groupify:logout'));

    // Call backend logout (which also removes token client-side)
    await apiLogout();
    
    logger.info('User logged out');
    
    // Clear state
    setTokenState(null);
    setUser(null);
    setAuthError(null);

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
    authError,
    retryAuth,
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

