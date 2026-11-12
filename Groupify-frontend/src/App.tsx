import { lazy, Suspense, type CSSProperties } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Loader2 } from "lucide-react";
import { UserProvider, useUser } from "./contexts/UserContext";
import { SocketProvider } from "./contexts/SocketContext";
import { PlayingGroupProvider } from "./contexts/PlayingGroupContext";
import { GroupsProvider } from "./contexts/GroupsContext";
import { SidebarProvider } from "./components/ui/sidebar";
import LoginScreen from "./components/features/auth/LoginScreen";
import DashboardScreen from "./components/features/dashboard/DashboardScreen";
import GroupFeedScreen from "./components/features/groups/GroupFeedScreen";
import AuthCallbackScreen from "./components/features/auth/AuthCallbackScreen";
import { Toaster } from "./components/ui/sonner";
import SpotifyPlayerCard from "./components/features/music/SpotifyPlayerCard";
import AppSidebar from "./components/layout/AppSidebar";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { RouteErrorBoundary } from "./components/layout/RouteErrorBoundary";
import { useGlobalPlaybackTracking } from "./hooks/useGlobalPlaybackTracking";
import { useAutoPlayNext } from "./hooks/useAutoPlayNext";
import { usePaneWidth } from "./hooks/usePaneWidth";
import OnboardingWalkthrough from "./components/features/onboarding/OnboardingWalkthrough";
import UpdatePrompt from "./components/features/pwa/UpdatePrompt";

const AnalyticsScreen = lazy(
  () => import("./components/features/analytics/AnalyticsScreen")
);
const ChangelogScreen = lazy(
  () => import("./components/features/changelog/ChangelogScreen")
);
const ProfileScreen = lazy(
  () => import("./components/features/profile/ProfileScreen")
);
const GroupSettingsScreen = lazy(
  () => import("./components/features/groups/GroupSettingsScreen")
);
const PlaylistViewScreen = lazy(
  () => import("./components/features/music/PlaylistViewScreen")
);

function LoadingFallback() {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * Main Layout component for authenticated routes
 */
/**
 * Inner layout that runs inside PlayingGroupProvider so hooks can access it.
 */
function AuthenticatedLayoutInner() {
  const location = useLocation();
  const { isLoading } = useUser();

  // Global playback tracking - works across all screens
  useGlobalPlaybackTracking();

  // Auto-play next song in group playlist when current track finishes
  useAutoPlayNext();

  const rail = usePaneWidth({ storageKey: "groupify-rail-width", initial: 248, min: 72, max: 340 });

  // Determine if we should show the floating player
  const showPlayer = !isLoading &&
    !location.pathname.includes('/profile') &&
    !location.pathname.match(/\/groups\/[^/]+$/) &&
    !location.pathname.includes('/settings') &&
    !location.pathname.includes('/analytics') &&
    !location.pathname.includes('/changelog');

  return (
    <SidebarProvider defaultOpen={false} style={{ "--rail-w": `${rail.width}px` } as CSSProperties}>
      {/* Desktop: rail and content are panes on the ground colour with 8px
          gutters. Phone: one pane; the rail is a sheet. Inside the content
          pane, "background" is the pane and cards are raised. */}
      <div className="flex w-full bg-ground md:h-dvh md:p-2">
        <AppSidebar rail={rail} />
        <div className="min-w-0 flex-1 bg-pane [--background:var(--pane)] [--card:var(--raised)] md:overflow-y-auto md:rounded-2xl">
          <div className="pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-24 w-full p-4 md:p-6">
            <RouteErrorBoundary key={location.pathname}>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/" element={<DashboardScreen />} />
                  <Route path="/profile" element={<ProfileScreen />} />
                  <Route path="/groups/:groupId" element={<GroupFeedScreen />} />
                  <Route path="/groups/:groupId/settings" element={<GroupSettingsScreen />} />
                  <Route path="/groups/:groupId/playlist" element={<PlaylistViewScreen />} />
                  <Route path="/groups/:groupId/analytics" element={<AnalyticsScreen />} />
                  <Route path="/changelog" element={<ChangelogScreen />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </RouteErrorBoundary>
          </div>
        </div>
      </div>

      {showPlayer && <SpotifyPlayerCard />}
      <OnboardingWalkthrough />
    </SidebarProvider>
  );
}

function AuthenticatedLayout() {
  return (
    <PlayingGroupProvider>
      <AuthenticatedLayoutInner />
    </PlayingGroupProvider>
  );
}

function AppContent() {
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
    // Dark by default. Users can pick light or "match device" in Profile.
    // Light is opt-in until every screen is restyled (#57 slices 3-10).
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      storageKey="groupify-theme"
      disableTransitionOnChange
    >
    <BrowserRouter>
      <UserProvider>
        {/* SocketProvider is inside UserProvider so it can read the auth token */}
        <SocketProvider>
          <GroupsProvider>
            <AppContent />
            <Toaster />
            <UpdatePrompt />
            <Analytics />
            <SpeedInsights />
          </GroupsProvider>
        </SocketProvider>
      </UserProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
