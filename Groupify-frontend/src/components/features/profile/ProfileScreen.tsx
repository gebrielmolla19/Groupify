import { useState, useEffect, useCallback, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import type { NotificationPreferences } from "../../../types";
import { Button } from "../../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { Switch } from "../../ui/switch";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { ThemeSwitch } from "./ThemeSwitch";
import MoreLinks from "./MoreLinks";
import SettingsSection, { eyebrow } from "./SettingsSection";
import { UserStats } from "../../../types";
import { useUser } from "../../../contexts/UserContext";
import { getUserStats, updateUserProfile } from "../../../lib/api";
import { requestPermissionAndSubscribe, unsubscribePush } from "../../../lib/pushNotifications";
import { toast } from "sonner";
import { Skeleton } from "../../ui/skeleton";
import { logger } from "../../../utils/logger";
import { useNavigate } from "react-router-dom";
import { cn } from "../../../lib/utils";

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, logout, fetchUser } = useUser();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushToggling, setPushToggling] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState<string | null>(null);

  // Check if push subscription exists on mount
  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub && Notification.permission === 'granted');
      } catch (error) {
        // The switch stays off; turning it on subscribes afresh.
        logger.warn('Could not read the push subscription:', error);
      }
    })();
  }, []);

  const handlePushToggle = async (checked: boolean) => {
    setPushToggling(true);
    try {
      if (checked) {
        await requestPermissionAndSubscribe();
        if ('Notification' in window) setPushPermission(Notification.permission);
        if (Notification.permission === 'granted') {
          setPushEnabled(true);
          toast.success('Push notifications enabled');
        } else if (Notification.permission === 'denied') {
          toast.error('Notifications blocked — enable them in your browser settings');
        }
      } else {
        await unsubscribePush();
        setPushEnabled(false);
        toast.success('Push notifications disabled');
      }
    } catch {
      toast.error('Failed to update push notifications');
    } finally {
      setPushToggling(false);
    }
  };

  const handlePreferenceChange = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    setSavingPrefs(key);
    try {
      await updateUserProfile({ notificationPreferences: { [key]: value } });
      await fetchUser();
    } catch {
      toast.error('Failed to update preference');
    } finally {
      setSavingPrefs(null);
    }
  }, [fetchUser]);

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
  const statTiles = [
    { label: "Tracks shared", value: stats?.tracksShared, yours: true },
    // Other members' listens to your shares, not your own listening.
    { label: "Listens to your shares", value: stats?.totalListens, yours: false },
    { label: "Groups", value: stats?.groupsJoined, yours: false },
  ];

  const pushHint =
    pushPermission === 'denied'
      ? 'Blocked in this browser. Open its site settings, allow notifications for Groupify, then reload.'
      : 'Lets Groupify notify this device.';

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 md:space-y-10">
      {/* Say it: who you are and how you're signed in. */}
      <header className="flex items-center gap-4 md:gap-5">
        <Avatar className="size-16 shrink-0 md:size-20">
          <AvatarImage src={user?.profileImage || undefined} alt="" className="object-cover" />
          <AvatarFallback className="bg-iris font-display text-2xl font-extrabold text-on-iris md:text-3xl">
            {user?.displayName ? getInitials(user.displayName) : 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className={eyebrow}>Profile and settings</p>
          <h1 className="mt-1 truncate font-display text-3xl font-extrabold leading-tight tracking-tight md:mt-2 md:text-5xl">
            {user?.displayName || 'Your profile'}
          </h1>
          <p className="mt-1 break-words text-soft md:mt-2 md:text-lg">
            Signed in with Spotify{user?.spotifyId ? ` as ${user.spotifyId}` : ''}
          </p>
        </div>
      </header>

      {/* Show it: your numbers. Yours is the one in iris. */}
      <section aria-label="Your numbers" className="grid grid-cols-3 gap-2.5 md:gap-4">
        {statTiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 rounded-2xl border border-hair bg-raised p-3.5 md:p-5">
            {isLoadingStats ? (
              <Skeleton className="h-8 w-12 md:h-10" />
            ) : (
              <span className={cn("font-display text-2xl font-extrabold tracking-tight md:text-4xl", tile.yours ? "text-iris" : "text-foreground")}>
                {tile.value ?? '–'}
              </span>
            )}
            <span className="text-xs text-soft md:text-sm">{tile.label}</span>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-8 md:gap-4 lg:grid-cols-2">
        <SettingsSection title="Account">
          <div className="space-y-1.5">
            <Label htmlFor="display-name" className="text-sm font-normal text-soft">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
            />
          </div>
          <dl className="divide-y divide-hair rounded-xl border border-hair">
            <div className="flex min-h-11 items-center justify-between gap-3 px-3.5">
              <dt className="shrink-0 text-sm text-soft">Spotify</dt>
              <dd className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm">{user?.spotifyId || 'Connected'}</span>
                <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-iris">Connected</span>
              </dd>
            </div>
            {user?.email && (
              <div className="flex min-h-11 items-center justify-between gap-3 px-3.5">
                <dt className="shrink-0 text-sm text-soft">Email</dt>
                <dd className="min-w-0 truncate text-sm">{user.email}</dd>
              </div>
            )}
          </dl>
          <p className="text-sm text-quiet">
            Your name and picture come from Spotify. Change the display name to show something else in your groups.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSaveChanges} disabled={!hasChanges || isUpdating}>
              {isUpdating ? 'Saving...' : 'Save changes'}
            </Button>
            {hasChanges && (
              <Button variant="ghost" onClick={handleCancel} disabled={isUpdating}>
                Cancel
              </Button>
            )}
          </div>
        </SettingsSection>

        <SettingsSection title="Notifications">
          <div className="-my-1 divide-y divide-hair">
            <ToggleRow id="push-toggle" label="Push notifications" hint={pushHint}>
              {pushPermission === 'denied' ? (
                <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-danger">Blocked</span>
              ) : (
                <Switch id="push-toggle" checked={pushEnabled} onCheckedChange={handlePushToggle} disabled={pushToggling} />
              )}
            </ToggleRow>
            <ToggleRow id="new-tracks" label="New tracks" hint="When someone shares to one of your groups">
              <Switch
                id="new-tracks"
                checked={user?.notificationPreferences?.song_shared !== false}
                onCheckedChange={(v) => handlePreferenceChange('song_shared', v)}
                disabled={savingPrefs === 'song_shared'}
              />
            </ToggleRow>
            <ToggleRow id="group-invites" label="Group invites" hint="When you're invited to a group">
              <Switch
                id="group-invites"
                checked={user?.notificationPreferences?.group_invite !== false}
                onCheckedChange={(v) => handlePreferenceChange('group_invite', v)}
                disabled={savingPrefs === 'group_invite'}
              />
            </ToggleRow>
            <ToggleRow id="member-joined" label="New members" hint="When someone joins one of your groups">
              <Switch
                id="member-joined"
                checked={user?.notificationPreferences?.member_joined !== false}
                onCheckedChange={(v) => handlePreferenceChange('member_joined', v)}
                disabled={savingPrefs === 'member_joined'}
              />
            </ToggleRow>
          </div>
        </SettingsSection>

        <SettingsSection title="Appearance">
          <ThemeSwitch />
          <p className="text-sm text-quiet">Device follows your phone or computer's setting.</p>
        </SettingsSection>

        <SettingsSection title="Account access">
          <Button variant="outline" className="self-start" onClick={handleLogout}>
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
          <p className="text-sm text-soft">
            To remove Groupify's access to your Spotify account, go to{" "}
            <a
              href="https://www.spotify.com/account/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-2 hover:text-iris"
            >
              Apps in your Spotify account settings
            </a>
            .
          </p>
        </SettingsSection>
      </div>

      {/* Phones only; desktop has these in the rail. */}
      <MoreLinks className="md:hidden" />
    </main>
  );
}

/** A labelled switch with a line saying what it does. The label is the touch target. */
function ToggleRow({ id, label, hint, children }: { id: string; label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-2">
      <Label htmlFor={id} className="min-w-0 flex-1 cursor-pointer flex-col items-start justify-center gap-0.5 self-stretch leading-snug">
        <span className="text-[15px] font-semibold text-foreground">{label}</span>
        <span className="text-sm font-normal text-soft">{hint}</span>
      </Label>
      <span className="shrink-0">{children}</span>
    </div>
  );
}
