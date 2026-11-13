import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "../ui/sidebar";
import AppRail from "./AppRail";
import PhoneTabBar from "./PhoneTabBar";
import CreateGroupDialog from "../features/groups/CreateGroupDialog";
import JoinGroupDialog from "../features/groups/JoinGroupDialog";
import { useGroups } from "../../hooks/useGroups";
import type { usePaneWidth } from "../../hooks/usePaneWidth";

/** Below this width the rail shows covers and icons only. */
export const RAIL_COMPACT_BELOW = 160;

interface AppSidebarProps {
  rail: ReturnType<typeof usePaneWidth>;
}

/**
 * Desktop: the rail pane plus the gutter that resizes it.
 * Phone: the bottom tab bar.
 */
export default function AppSidebar({ rail }: AppSidebarProps) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const { createGroup, joinGroupByCode } = useGroups();
  const [dialog, setDialog] = useState<"create" | "join" | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async (inviteCode: string) => {
    setIsJoining(true);
    try {
      const joined = await joinGroupByCode(inviteCode);
      navigate(`/groups/${joined._id}`);
    } finally {
      setIsJoining(false);
    }
  };

  const dialogs = (
    <>
      <CreateGroupDialog open={dialog === "create"} onOpenChange={(open) => setDialog(open ? "create" : null)} onCreateGroup={createGroup} />
      <JoinGroupDialog open={dialog === "join"} onOpenChange={(open) => setDialog(open ? "join" : null)} onJoinGroup={handleJoin} isSubmitting={isJoining} />
    </>
  );
  const railActions = { onNewGroup: () => setDialog("create"), onJoinGroup: () => setDialog("join") };

  if (isMobile) return <PhoneTabBar />;

  return (
    <>
      <aside aria-label="Sidebar" className="h-full shrink-0 overflow-hidden rounded-2xl bg-pane" style={{ width: rail.width }}>
        <AppRail compact={rail.width < RAIL_COMPACT_BELOW} {...railActions} />
      </aside>
      {/* 8px to look at; 44px to grab on touch screens (CONTRIBUTING §2.4). */}
      <div
        {...rail.separatorProps}
        aria-label="Resize sidebar"
        className="group relative flex w-2 shrink-0 cursor-col-resize touch-none select-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:before:absolute pointer-coarse:before:inset-y-0 pointer-coarse:before:-inset-x-[18px] pointer-coarse:before:content-['']"
      >
        <span aria-hidden="true" className="h-9 w-0.5 rounded-full bg-line transition-colors group-hover:bg-lit group-focus-visible:bg-iris" />
      </div>
      {dialogs}
    </>
  );
}
