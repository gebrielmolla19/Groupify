/**
 * Auth Callback Screen
 * Handles OAuth callback from Spotify and authenticates the user
 */

import { useEffect, useState, useRef } from 'react';
import { useUser } from "../../../contexts/UserContext";
import { toast } from 'sonner';

interface AuthCallbackScreenProps {
  onNavigate: (screen: 'dashboard') => void;
}

export default function AuthCallbackScreen({ onNavigate }: AuthCallbackScreenProps) {
  const { login } = useUser();
  const [error, setError] = useState<string | null>(null);
  const hasProcessedCallback = useRef(false);

  useEffect(() => {
    // Prevent duplicate execution (React Strict Mode in dev runs effects twice)
    if (hasProcessedCallback.current) {
      return;
    }

    const handleCallback = async () => {
      hasProcessedCallback.current = true;

      try {
        // Extract token from URL query params
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const errorParam = urlParams.get('error');

        if (errorParam) {
          const errorMsg = `Authentication failed: ${errorParam}`;
          setError(errorMsg);
          toast.error(errorMsg);
          return;
        }

        if (!token) {
          const errorMsg = 'No authentication token received';
          setError(errorMsg);
          toast.error(errorMsg);
          return;
        }

        // Login with the token
        await login(token);

        // Show success message
        toast.success("Successfully logged in with Spotify!");

        // Clear the token from URL for security and update path
        window.history.replaceState({}, document.title, '/');

        // Navigate to dashboard
        onNavigate('dashboard');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to complete authentication';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    };

    handleCallback();
  }, [login, onNavigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-6 text-center">
          <div
            className="bg-destructive/10 border border-destructive/30 rounded-lg p-6"
            role="alert"
            aria-live="assertive"
          >
            <h2 className="text-xl font-semibold text-destructive mb-2">Authentication Error</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-primary text-black rounded-md hover:bg-primary/90 transition-colors"
              aria-label="Return to login page"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-6 text-center">
        <div className="space-y-4" role="status" aria-live="polite">
          <div
            className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"
            aria-hidden="true"
          />
          <p className="text-muted-foreground">Completing authentication...</p>
        </div>
      </div>
    </div>
  );
}

