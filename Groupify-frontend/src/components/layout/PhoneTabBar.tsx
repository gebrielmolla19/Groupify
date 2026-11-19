import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Home, LayoutGrid, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useGroups } from "../../hooks/useGroups";
import { useLastGroup } from "../../hooks/useLastGroup";
import { useNotifications } from "../../hooks/useNotifications";

/**
 * Phone navigation: one pane at a time, switched from a bottom tab bar.
 * Activity shows how many new things are waiting there.
 */
export default function PhoneTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { groups, isLoading } = useGroups();
  const lastGroupId = useLastGroup();
  const { unreadCount } = useNotifications();

  // Back to the group last opened, if the user is still in it; else Home.
  // Until the groups have loaded, trust the remembered one.
  const stillMember = isLoading || groups.some((g) => g._id === lastGroupId);
  const groupsTarget = lastGroupId && stillMember ? `/groups/${lastGroupId}` : "/";

  const tabs: { label: string; icon: LucideIcon; to: string; active: boolean; badge?: number }[] = [
    { label: "Home", icon: Home, to: "/", active: pathname === "/" },
    { label: "Groups", icon: LayoutGrid, to: groupsTarget, active: pathname.startsWith("/groups/") },
    { label: "Activity", icon: Bell, to: "/activity", active: pathname === "/activity", badge: unreadCount },
    { label: "You", icon: User, to: "/profile", active: pathname === "/profile" },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-hair bg-linear-to-b from-ground/75 to-ground to-50% px-2 pt-1 pb-[calc(12px+env(safe-area-inset-bottom))]"
    >
      {tabs.map(({ label, icon: Icon, to, active, badge }) => (
        <button
          key={label}
          type="button"
          onClick={() => navigate(to)}
          aria-current={active ? "page" : undefined}
          aria-label={badge ? `${label}, ${badge} new` : label}
          className={cn(
            "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active ? "text-iris" : "text-soft",
          )}
        >
          <span className="relative">
            <Icon className="size-[22px]" strokeWidth={2} aria-hidden="true" />
            {badge ? (
              <span aria-hidden="true" className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-iris px-1 font-mono text-[10px] font-bold text-on-iris">
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}
