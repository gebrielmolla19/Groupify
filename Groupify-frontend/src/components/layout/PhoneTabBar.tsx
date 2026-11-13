import { useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutGrid, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useGroups } from "../../hooks/useGroups";
import { useLastGroup } from "../../hooks/useLastGroup";

/**
 * Phone navigation: one pane at a time, switched from a bottom tab bar.
 * Activity joins it with its screen (#57 slice 7).
 */
export default function PhoneTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { groups } = useGroups();
  const lastGroupId = useLastGroup();

  // Back to the group last opened, if the user is still in it; else Home.
  const groupsTarget =
    lastGroupId && groups.some((g) => g._id === lastGroupId) ? `/groups/${lastGroupId}` : "/";

  const tabs: { label: string; icon: LucideIcon; to: string; active: boolean }[] = [
    { label: "Home", icon: Home, to: "/", active: pathname === "/" },
    { label: "Groups", icon: LayoutGrid, to: groupsTarget, active: pathname.startsWith("/groups/") },
    { label: "You", icon: User, to: "/profile", active: pathname === "/profile" },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-hair bg-ground px-2 pt-1 pb-[calc(12px+env(safe-area-inset-bottom))]"
    >
      {tabs.map(({ label, icon: Icon, to, active }) => (
        <button
          key={label}
          type="button"
          onClick={() => navigate(to)}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active ? "text-iris" : "text-soft",
          )}
        >
          <Icon className="size-[22px]" strokeWidth={2} aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  );
}
