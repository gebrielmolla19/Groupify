export type ChangelogCategory = "new" | "improvement" | "fix";

export interface ChangelogItem {
  date: string;          // ISO date, e.g. "2026-04-08"
  category: ChangelogCategory;
  title: string;
}

export const categoryLabels: Record<ChangelogCategory, string> = {
  new: "NEW",
  improvement: "IMPROVEMENT",
  fix: "FIX",
};

export const changelog: ChangelogItem[] = [
  // April 2026
  { date: "2026-04-08", category: "new", title: "AI-powered listener reflex insights via Gemini integration" },
  { date: "2026-04-08", category: "new", title: "PWA update prompt notifies you when a new version is available" },
  { date: "2026-04-07", category: "new", title: "Vercel Speed Insights and Web Analytics integration" },
  { date: "2026-04-05", category: "improvement", title: "Improved playback reliability with remote controls and device readiness checks" },
  { date: "2026-04-05", category: "improvement", title: "Auto-play next song in group playlist when current track finishes" },
  { date: "2026-04-04", category: "fix", title: "Stabilized next/prev track ordering and pause before switching" },
  { date: "2026-04-04", category: "fix", title: "Fixed playback error recovery for more reliable streaming" },
  { date: "2026-04-02", category: "improvement", title: "GroupsContext refactored for better state management" },

  // March 2026
  { date: "2026-03-20", category: "new", title: "PWA push notifications for group invites and activity" },
  { date: "2026-03-20", category: "new", title: "Unified notification bell with consolidated invite notifications" },
  { date: "2026-03-18", category: "new", title: "Onboarding walkthrough tour for new users" },
  { date: "2026-03-15", category: "improvement", title: "Notification card layout simplified and cleaned up" },
  { date: "2026-03-15", category: "improvement", title: "Listening style description shown below badge in analytics" },
  { date: "2026-03-12", category: "fix", title: "AlertDialog footer buttons properly centered with constrained width" },
  { date: "2026-03-12", category: "fix", title: "Handle non-JSON push payloads in service worker" },
  { date: "2026-03-10", category: "fix", title: "Show actionable instructions when push notifications are blocked" },
  { date: "2026-03-05", category: "new", title: "Create and join music sharing groups with invite codes" },
  { date: "2026-03-05", category: "new", title: "Share Spotify tracks to group feeds in real-time" },
  { date: "2026-03-05", category: "new", title: "Mark tracks as listened and compete on leaderboards" },
  { date: "2026-03-05", category: "new", title: "Group analytics with listening stats and Listener Reflex radar" },
  { date: "2026-03-05", category: "new", title: "Integrated Spotify playback with floating player card" },
];
