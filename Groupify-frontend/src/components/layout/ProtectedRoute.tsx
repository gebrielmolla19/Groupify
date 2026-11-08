import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * A wrapper component that redirects to login if the user is not authenticated.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, token, authError, retryAuth, logout } = useUser();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center" role="status">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && token && authError) {
    // Signed in, but the session couldn't be checked (server unreachable or
    // failing). Don't send them to /login: the token is still good.
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Can't reach Groupify</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground" role="alert">
              {authError}
            </p>
            <p className="text-sm text-muted-foreground">You're still signed in.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="min-h-11" onClick={() => retryAuth()}>
                Try again
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => logout()}>
                Log out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
