import { useState, useEffect } from "react";
import { Mail, Bell, Palette, LogOut, User as UserIcon, Music } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { Switch } from "../../ui/switch";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Separator } from "../../ui/separator";
import { SidebarTrigger } from "../../ui/sidebar";
import { Badge } from "../../ui/badge";
import { UserStats } from "../../../types";
import { useUser } from "../../../contexts/UserContext";
import { getUserStats, updateUserProfile } from "../../../lib/api";
import { toast } from "sonner";
import { Skeleton } from "../../ui/skeleton";
import { logger } from "../../../utils/logger";
import { useNavigate } from "react-router-dom";

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, logout, fetchUser } = useUser();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Get user initials for avatar fallback
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Load user stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const userStats = await getUserStats();
        setStats(userStats);
      } catch (error) {
        logger.error('Failed to load stats:', error);
        toast.error('Failed to load statistics');
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadStats();
  }, []);

  // Update display name when user changes
  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]);

  // Check for changes
  useEffect(() => {
    setHasChanges(displayName !== user?.displayName);
  }, [displayName, user]);

  const handleSaveChanges = async () => {
    if (!hasChanges) return;

    setIsUpdating(true);
    try {
      await updateUserProfile({ displayName });
      await fetchUser(); // Refresh user data
      logger.info('Profile updated:', { displayName });
      toast.success('Profile updated successfully');
      setHasChanges(false);
    } catch (error) {
      logger.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(user?.displayName || "");
    setHasChanges(false);
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate('/login');
  };
  return (
      <>
        {/* Header */}
        <header className="sticky top-0 z-10 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center gap-4 px-4 md:px-6">
            <SidebarTrigger />
              <div className="flex-1 min-w-0">
                <h1 className="truncate">Profile & Settings</h1>
                <p className="text-sm text-muted-foreground truncate">
                  Manage your account and preferences
                </p>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="p-4 md:p-6 max-w-4xl">
            {/* Profile Section */}
            <Card className="mb-6 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-primary" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Your Spotify account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start gap-6">
                  <div className="relative">
                    <Avatar className="w-24 h-24 border-2 border-primary/30">
                      <AvatarImage src={user?.profileImage || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xl">
                        {user?.displayName ? getInitials(user.displayName) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <Label htmlFor="display-name">Display Name</Label>
                      <Input
                        id="display-name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="mt-1.5 bg-muted/50 border-border"
                        placeholder="Enter your display name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={`@${user?.spotifyId || 'user'}`}
                        className="mt-1.5 bg-muted/50 border-border"
                        disabled
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Your username is synced from Spotify
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <div className="flex items-center gap-2 mt-1.5 p-3 rounded-lg bg-muted/30 border border-border min-w-0">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">
                        {user?.email || 'Not provided'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label>Spotify Account</Label>
                    <div className="flex items-center gap-2 mt-1.5 p-3 rounded-lg bg-muted/30 border border-border">
                      <svg
                        className="w-4 h-4 text-primary shrink-0"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                      </svg>
                      <span className="text-sm">Connected</span>
                      <Badge className="ml-auto bg-primary/10 text-primary border-primary/30 text-xs shrink-0">
                        Premium
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="border-primary/30 hover:bg-primary/10"
                    onClick={handleSaveChanges}
                    disabled={!hasChanges || isUpdating}
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={!hasChanges || isUpdating}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="mb-6 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="w-5 h-5 text-primary shrink-0" />
                  Your Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingStats ? (
                  <div className="grid grid-cols-3 gap-2 md:gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="text-center p-3 md:p-4 rounded-lg bg-muted/30 border border-border">
                        <Skeleton className="h-8 md:h-10 w-16 mx-auto mb-2" />
                        <Skeleton className="h-4 w-20 mx-auto" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 md:gap-4">
                    <div className="text-center p-3 md:p-4 rounded-lg bg-muted/30 border border-border">
                      <p className="text-2xl md:text-3xl text-primary mb-1">
                        {stats?.tracksShared || 0}
                      </p>
                      <p className="text-xs md:text-sm text-muted-foreground">Tracks Shared</p>
                    </div>
                    <div className="text-center p-3 md:p-4 rounded-lg bg-muted/30 border border-border">
                      <p className="text-2xl md:text-3xl text-primary mb-1">
                        {stats?.groupsJoined || 0}
                      </p>
                      <p className="text-xs md:text-sm text-muted-foreground">Groups Joined</p>
                    </div>
                    <div className="text-center p-3 md:p-4 rounded-lg bg-muted/30 border border-border">
                      <p className="text-2xl md:text-3xl text-primary mb-1">
                        {stats?.totalListens || 0}
                      </p>
                      <p className="text-xs md:text-sm text-muted-foreground">Total Listens</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="mb-6 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Manage how you receive updates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="new-tracks">New Track Shares</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone shares a new track
                    </p>
                  </div>
                  <Switch id="new-tracks" defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="group-invites">Group Invites</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications for new group invitations
                    </p>
                  </div>
                  <Switch id="group-invites" defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="leaderboard">Leaderboard Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Weekly summary of your position on leaderboards
                    </p>
                  </div>
                  <Switch id="leaderboard" defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="recommendations">Recommendations</Label>
                    <p className="text-sm text-muted-foreground">
                      Get personalized track recommendations
                    </p>
                  </div>
                  <Switch id="recommendations" />
                </div>
              </CardContent>
            </Card>

            {/* Appearance */}
            <Card className="mb-6 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  Appearance
                </CardTitle>
                <CardDescription>
                  Customize the look and feel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <Label>Theme</Label>
                    <p className="text-sm text-muted-foreground">
                      Dark mode with cyber-green accents
                    </p>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/30">
                    Active
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive-foreground">
                  <LogOut className="w-5 h-5" />
                  Account Actions
                </CardTitle>
                <CardDescription>
                  Manage your account access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full border-destructive/30 hover:bg-destructive/10 text-destructive-foreground"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-destructive/50 hover:bg-destructive/20 text-destructive-foreground"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect Spotify
                </Button>
              </CardContent>
            </Card>
          </main>
      </>
  );
}
