/**
 * Auth Callback Screen
 * Handles OAuth callback from Spotify and authenticates the user
 */

import { useEffect, useState, useRef } from 'react';
import { useUser } from "../../../contexts/UserContext";
import { exchangeCode } from '../../../lib/api';
import { toast } from 'sonner';
import { logger } from '../../../utils/logger';
import { useNavigate } from 'react-router-dom';

export default function AuthCallbackScreen() {
  const { login } = useUser();
  const navigate = useNavigate();
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
        logger.info('Auth callback received');
        // Extract one-time code from URL query params
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const errorParam = urlParams.get('error');

        if (errorParam) {
          const errorMsg = `Authentication failed: ${errorParam}`;
          logger.error('Auth callback failed:', { error: errorParam });
          setError(errorMsg);
          toast.error(errorMsg);
          return;
        }

        if (!code) {
          const errorMsg = 'No authentication code received';
          logger.error('Auth callback failed:', { error: 'No code' });
          setError(errorMsg);
          toast.error(errorMsg);
          return;
        }

        // Exchange one-time code for JWT, then login
        const token = await exchangeCode(code);
        await login(token);

        // Show success message
        toast.success("Successfully logged in with Spotify!");

        // Clear the token from URL for security and update path
        window.history.replaceState({}, document.title, '/');

        // Navigate to dashboard
        navigate('/');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to complete authentication';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    };

    handleCallback();
  }, [login, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full mx-auto text-center">
          <div
            className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 md:p-6"
            role="alert"
            aria-live="assertive"
          >
            <h2 className="text-lg md:text-xl font-semibold text-destructive mb-2">Authentication Error</h2>
            <p className="text-sm md:text-base text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-4 py-2 bg-primary text-black rounded-md hover:bg-primary/90 transition-colors min-h-[44px]"
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full mx-auto text-center">
        <div className="space-y-4" role="status" aria-live="polite">
          <div
            className="inline-block animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-4 border-primary border-t-transparent"
            aria-hidden="true"
          />
          <p className="text-sm md:text-base text-muted-foreground">Completing authentication...</p>
        </div>
      </div>
    </div>
  );
}
