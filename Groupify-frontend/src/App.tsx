import { useState, useEffect } from "react";
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
import { Group, ScreenName } from "./types";

interface AppWithPlayerProps {
  currentScreen: ScreenName;
  selectedGroup: Group | null;
  onNavigate: (screen: ScreenName, group?: Group) => void;
}

function AppWithPlayer({ currentScreen, selectedGroup, onNavigate }: AppWithPlayerProps) {
  return (
    <div className="pb-24 w-full">
      {currentScreen === "dashboard" && (
        <DashboardScreen onNavigate={onNavigate} />
      )}
      {currentScreen === "group-feed" && (
        <GroupFeedScreen group={selectedGroup} onNavigate={onNavigate} />
      )}
      {currentScreen === "group-settings" && (
        <GroupSettingsScreen group={selectedGroup} onNavigate={onNavigate} />
      )}
      {currentScreen === "playlist" && (
        <PlaylistViewScreen group={selectedGroup} onNavigate={onNavigate} />
      )}
      {currentScreen === "analytics" && (
        <AnalyticsScreen group={selectedGroup} onNavigate={onNavigate} />
      )}
      {currentScreen === "profile" && (
        <ProfileScreen onNavigate={onNavigate} />
      )}
    </div>
  );
}

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>("login");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const { isAuthenticated, isLoading } = useUser();

  // Apply dark mode by default
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Check if we're on the auth callback route
  useEffect(() => {
    if (window.location.pathname === '/auth/callback') {
      setCurrentScreen('auth-callback');
    }
  }, []);

  // Try to restore screen state from sessionStorage on mount
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const savedScreen = sessionStorage.getItem('currentScreen') as ScreenName | null;
      const savedGroupId = sessionStorage.getItem('selectedGroupId');

      if (savedScreen && savedScreen !== 'login' && savedScreen !== 'auth-callback') {
        setCurrentScreen(savedScreen);

        // If we have a saved group ID, try to fetch the group
        if (savedGroupId && (savedScreen === 'playlist' || savedScreen === 'group-feed' || savedScreen === 'group-settings')) {
          // Note: We'd need to fetch the group here, but for now just restore the screen
          // The group will need to be passed via navigation
        }
      }
    }
  }, [isAuthenticated, isLoading]);

  // Auto-redirect based on authentication state
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && currentScreen === "login") {
        setCurrentScreen("dashboard");
      } else if (!isAuthenticated && currentScreen !== "login" && currentScreen !== "auth-callback") {
        setCurrentScreen("login");
      }
    }
  }, [isAuthenticated, isLoading, currentScreen]);

  const handleNavigate = (screen: ScreenName, group?: Group) => {
    setCurrentScreen(screen);
    if (group) {
      setSelectedGroup(group);
      // Save to sessionStorage for refresh persistence
      sessionStorage.setItem('selectedGroupId', group._id);
    } else {
      sessionStorage.removeItem('selectedGroupId');
    }
    // Save current screen to sessionStorage
    sessionStorage.setItem('currentScreen', screen);
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!isAuthenticated && currentScreen === "login" && (
        <div className="min-h-screen bg-background">
          <LoginScreen />
        </div>
      )}
      
      {currentScreen === "auth-callback" && (
        <div className="min-h-screen bg-background">
          <AuthCallbackScreen onNavigate={handleNavigate} />
        </div>
      )}
      
      {isAuthenticated && (
        <PlayingGroupProvider>
          <div className="min-h-screen bg-background">
            <SidebarProvider>
              <AppSidebar currentScreen={currentScreen} onNavigate={handleNavigate} />
              <SidebarInset>
                <AppWithPlayer
                  currentScreen={currentScreen}
                  selectedGroup={selectedGroup}
                  onNavigate={handleNavigate}
                />
              </SidebarInset>
              
              {/* Persistent Spotify Player - Inside SidebarProvider but outside SidebarInset */}
              {/* Hide player on profile screen, group-feed (has its own player), and group-settings */}
              {currentScreen !== "profile" && currentScreen !== "group-feed" && currentScreen !== "group-settings" && (
                <SpotifyPlayerCard selectedGroup={selectedGroup} />
              )}
            </SidebarProvider>
          </div>
        </PlayingGroupProvider>
      )}
    </>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppContent />
      <Toaster />
    </UserProvider>
  );
}
