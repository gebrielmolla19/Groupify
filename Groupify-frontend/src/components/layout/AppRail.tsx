import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HelpCircle, Home, Music, Plus, ScrollText, UserPlus } from "lucide-react";
import { cn } from "../../lib/utils";
import { useUser } from "../../contexts/UserContext";
import { useGroups } from "../../hooks/useGroups";
import { useChangelogStatus } from "../../hooks/useChangelogStatus";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import GroupCover from "../features/groups/GroupCover";
import CreateGroupDialog from "../features/groups/CreateGroupDialog";
import JoinGroupDialog from "../features/groups/JoinGroupDialog";
import { startTour } from "../features/onboarding/OnboardingWalkthrough";

interface AppRailProps {
  /** Covers and icons only; labels stay available to screen readers. */
  compact: boolean;
  /** Called after any navigation, e.g. to close the phone sheet. */
  onNavigate?: () => void;
}

/** Rail contents: home, the user's groups with their covers, and "You". */
export default function AppRail({ compact, onNavigate }: AppRailProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useUser();
  const { groups, createGroup, joinGroupByCode } = useGroups();
  const { hasUnread } = useChangelogStatus();
  const [dialog, setDialog] = useState<"create" | "join" | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const handleJoin = async (inviteCode: string) => {
    setIsJoining(true);
    try {
      const joined = await joinGroupByCode(inviteCode);
      go(`/groups/${joined._id}`);
    } finally {
      setIsJoining(false);
    }
  };

  const label = (text: string) => <span className={compact ? "sr-only" : "truncate"}>{text}</span>;
  const row = (active = false) =>
    cn(
      "flex min-h-11 w-full shrink-0 items-center gap-3 rounded-[10px] px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-selected/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active && "bg-selected hover:bg-selected",
      compact && "justify-center px-0",
    );

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 px-2 py-3">
      <div className={cn("flex items-center gap-2.5 px-2 pb-3 pt-1", compact && "justify-center px-0")}>
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-iris text-on-iris">
          <Music className="size-[18px]" strokeWidth={2.5} />
        </span>
        <span className={cn("font-display text-xl font-extrabold tracking-tight", compact && "sr-only")}>Groupify</span>
      </div>

      <button type="button" className={row(pathname === "/")} aria-current={pathname === "/" ? "page" : undefined} onClick={() => go("/")} title={compact ? "Home" : undefined}>
        <Home className="size-5 shrink-0" aria-hidden="true" />
        {label("Home")}
      </button>

      <span className={cn("px-3 pb-1.5 pt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-quiet", compact && "sr-only")}>Groups</span>
      <nav aria-label="Groups" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {groups.map((group) => {
          const active = pathname === `/groups/${group._id}` || pathname.startsWith(`/groups/${group._id}/`);
          return (
            <button
              key={group._id}
              type="button"
              className={cn(row(active), "min-h-[52px] px-2 py-1.5")}
              aria-current={active ? "page" : undefined}
              onClick={() => go(`/groups/${group._id}`)}
              title={compact ? group.name : undefined}
            >
              <GroupCover groupId={group._id} className="size-10 rounded-sm" />
              <span className={compact ? "sr-only" : "flex min-w-0 flex-1 flex-col gap-0.5"}>
                <span className="truncate">{group.name}</span>
                <span className="truncate text-xs font-normal text-quiet">
                  {group.members.length} {group.members.length === 1 ? "member" : "members"}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn(row(), "border border-dashed border-line text-soft")} title={compact ? "New or join group" : undefined}>
            <Plus className="size-5 shrink-0" aria-hidden="true" />
            {label("New or join group")}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end">
          <DropdownMenuItem onSelect={() => setDialog("create")}>
            <Plus aria-hidden="true" /> New group
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("join")}>
            <UserPlus aria-hidden="true" /> Join with a code
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button type="button" className={cn(row(), "text-soft")} onClick={() => { onNavigate?.(); startTour(); }} title={compact ? "Take the tour" : undefined}>
        <HelpCircle className="size-5 shrink-0" aria-hidden="true" />
        {label("Take the tour")}
      </button>
      <button type="button" className={cn(row(pathname === "/changelog"), "text-soft")} aria-current={pathname === "/changelog" ? "page" : undefined} onClick={() => go("/changelog")} title={compact ? "What's new" : undefined}>
        <span className="relative shrink-0">
          <ScrollText className="size-5" aria-hidden="true" />
          {hasUnread && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-iris" aria-hidden="true" />}
        </span>
        {label(hasUnread ? "What's new (unread)" : "What's new")}
      </button>

      <button type="button" className={cn(row(pathname === "/profile"), "min-h-[52px] px-2 py-1.5")} aria-current={pathname === "/profile" ? "page" : undefined} onClick={() => go("/profile")} title={compact ? "You" : undefined}>
        <Avatar className="size-9 shrink-0" aria-hidden="true">
          <AvatarImage src={user?.profileImage || undefined} alt="" />
          <AvatarFallback className="bg-iris text-[13px] font-bold text-on-iris">
            {user?.displayName?.charAt(0).toUpperCase() || "Y"}
          </AvatarFallback>
        </Avatar>
        {label("You")}
      </button>

      <CreateGroupDialog open={dialog === "create"} onOpenChange={(open) => setDialog(open ? "create" : null)} onCreateGroup={createGroup} />
      <JoinGroupDialog open={dialog === "join"} onOpenChange={(open) => setDialog(open ? "join" : null)} onJoinGroup={handleJoin} isSubmitting={isJoining} />
    </div>
  );
}
