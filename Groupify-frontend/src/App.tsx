import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { UserProvider, useUser } from "./contexts/UserContext";
import { PlayingGroupProvider } from "./contexts/PlayingGroupContext";
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar";
import LoginScreen from "./components/features/auth/LoginScreen";
import DashboardScreen from "./components/features/dashboard/DashboardScreen";
import GroupFeedScreen from "./components/features/groups/GroupFeedScreen";
import GroupSettingsScreen from "./components/features/groups/GroupSettingsScreen";
import PlaylistViewScreen from "./components/features/music/PlaylistViewScreen";
import AnalyticsScreen from "./components/features/analytics/AnalyticsScreen";
import ProfileScreen from "./components/features/profile/ProfileScreen";
import AuthCallbackScreen from "./components/features/auth/AuthCallbackScreen";
import { Toaster } from "./components/ui/sonner";
import SpotifyPlayerCard from "./components/features/music/SpotifyPlayerCard";
import AppSidebar from "./components/layout/AppSidebar";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { useGlobalPlaybackTracking } from "./hooks/useGlobalPlaybackTracking";

/**
 * Main Layout component for authenticated routes
 */
function AuthenticatedLayout() {
  const location = useLocation();
  const { isLoading } = useUser();
  
  // Global playback tracking - works across all screens
  useGlobalPlaybackTracking();

  // Determine if we should show the floating player
  // Hide player on profile screen, group-feed (has its own player), group-settings, and analytics
  const showPlayer = !isLoading && 
    !location.pathname.includes('/profile') && 
    !location.pathname.match(/\/groups\/[^/]+$/) && // group-feed
    !location.pathname.includes('/settings') && 
    !location.pathname.includes('/analytics');

  return (
    <PlayingGroupProvider>
      <div className="min-h-screen bg-background">
        <SidebarProvider defaultOpen={false}>
          <AppSidebar />
          <SidebarInset>
            <div className="pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-24 w-full p-4 md:p-6">
              <Routes>
                <Route path="/" element={<DashboardScreen />} />
                <Route path="/profile" element={<ProfileScreen />} />
                <Route path="/groups/:groupId" element={<GroupFeedScreen />} />
                <Route path="/groups/:groupId/settings" element={<GroupSettingsScreen />} />
                <Route path="/groups/:groupId/playlist" element={<PlaylistViewScreen />} />
                <Route path="/groups/:groupId/analytics" element={<AnalyticsScreen />} />
                {/* Fallback for authenticated users */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </SidebarInset>
          
          {/* Persistent Spotify Player */}
          {showPlayer && <SpotifyPlayerCard />}
        </SidebarProvider>
      </div>
    </PlayingGroupProvider>
  );
}

function AppContent() {
  // Apply dark mode by default
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/auth/callback" element={<AuthCallbackScreen />} />
      
      {/* Protected Routes */}
      <Route 
        path="/*" 
        element={
          <ProtectedRoute>
            <AuthenticatedLayout />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <AppContent />
        <Toaster />
      </UserProvider>
    </BrowserRouter>
  );
}
