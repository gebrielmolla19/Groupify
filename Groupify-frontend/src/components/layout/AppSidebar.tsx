import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "../ui/sidebar";
import AppRail from "./AppRail";
import PhoneTabBar from "./PhoneTabBar";
import CreateGroupDialog from "../features/groups/CreateGroupDialog";
import JoinGroupDialog from "../features/groups/JoinGroupDialog";
import { useGroups } from "../../hooks/useGroups";
import type { usePaneWidth } from "../../hooks/usePaneWidth";
import PaneGutter from "./PaneGutter";

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

  const handleCreate = async (data: { name: string; description?: string }) => {
    const created = await createGroup(data);
    navigate(`/groups/${created._id}`);
    return created;
  };

  const dialogs = (
    <>
      <CreateGroupDialog open={dialog === "create"} onOpenChange={(open) => setDialog(open ? "create" : null)} onCreateGroup={handleCreate} />
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
      <PaneGutter separatorProps={rail.separatorProps} label="Resize sidebar" />
      {dialogs}
    </>
  );
}
