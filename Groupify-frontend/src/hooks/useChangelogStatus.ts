import { useState, useCallback, useMemo } from "react";
import { changelog } from "../data/changelog";

const STORAGE_KEY = "groupify_changelog_last_seen";

export function useChangelogStatus() {
  const latestVersion = changelog[0]?.date ?? "0";

  const [lastSeen, setLastSeen] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );

  const hasUnread = useMemo(() => lastSeen !== latestVersion, [lastSeen, latestVersion]);

  const markAsRead = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, latestVersion);
    setLastSeen(latestVersion);
  }, [latestVersion]);

  return { hasUnread, markAsRead };
}
