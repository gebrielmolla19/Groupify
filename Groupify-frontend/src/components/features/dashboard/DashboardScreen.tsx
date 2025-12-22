import { useState } from "react";
import { Plus, Users, UserPlus, Copy, Check } from "lucide-react";
import { Card, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import { SidebarTrigger } from "../../ui/sidebar";
import CreateGroupDialog from "../groups/CreateGroupDialog";
import JoinGroupDialog from "../groups/JoinGroupDialog";
import InvitesDropdown from "../groups/InvitesDropdown";
import GroupThumbnail from "../groups/GroupThumbnail";
import { Group } from "../../../types";
import { useGroups } from "../../../hooks/useGroups";
import { useUserInvites } from "../../../hooks/useUserInvites";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { logger } from "../../../utils/logger";

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { groups, isLoading, error, createGroup, joinGroupByCode } = useGroups();
  const {
    invites: userInvites,
    isLoading: isLoadingInvites,
    error: invitesError,
    acceptInvite,
    declineInvite
  } = useUserInvites();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [revealedCodes, setRevealedCodes] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleNavigateToGroup = (group: Group) => {
    navigate(`/groups/${group._id}`);
  };

  const handleOpenCreateDialog = () => {
    setIsCreateDialogOpen(true);
  };

  const handleOpenJoinDialog = () => {
    setIsJoinDialogOpen(true);
  };

  const handleJoinGroup = async (inviteCode: string) => {
    try {
      setIsJoining(true);
      const joinedGroup = await joinGroupByCode(inviteCode);
      // Navigate to group feed with the joined group
      navigate(`/groups/${joinedGroup._id}`);
    } catch (error) {
      // Error is already handled by the hook (toast notification)
      throw error;
    } finally {
      setIsJoining(false);
    }
  };

  const handleRevealAndCopyInviteCode = async (inviteCode: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click from firing

    // Reveal the code
    setRevealedCodes(prev => new Set(prev).add(inviteCode));

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(inviteCode);
      logger.info('Invite code copied:', { inviteCode });
      toast.success('Invite code copied to clipboard!');

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedCode(null);
      }, 2000);
    } catch (err) {
      logger.error('Failed to copy invite code:', err);
      toast.error('Failed to copy invite code');
    }
  };

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
        <div className="flex items-center gap-2 md:gap-4 px-4 md:px-6 py-3 md:py-4">
          <SidebarTrigger />
              <div className="flex-1 min-w-0">
                <h1 className="text-base md:text-lg truncate">My Groups</h1>
                <p className="text-xs md:text-sm text-muted-foreground truncate hidden sm:block">
                  Manage and explore your music sharing groups
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <InvitesDropdown
                  invites={userInvites}
                  onAcceptInvite={acceptInvite}
                  onDeclineInvite={declineInvite}
                  isLoading={isLoadingInvites}
                  error={invitesError}
                />
                <Button
                  variant="outline"
                  className="border-primary/30 hover:bg-primary hover:text-black hover:border-primary shrink-0 min-h-[44px]"
                  aria-label="Join a group"
                  onClick={handleOpenJoinDialog}
                >
                  <UserPlus className="w-4 h-4 sm:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Join Group</span>
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90 text-black shrink-0 min-h-[44px]"
                  aria-label="Create new group"
                  onClick={handleOpenCreateDialog}
                >
                  <Plus className="w-4 h-4 sm:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Create New Group</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="p-4 md:p-6 relative z-0 space-y-4 md:space-y-6">
            {/* Error State */}
            {error && (
              <Card className="border-destructive mb-6">
                <CardContent className="p-6">
                  <p className="text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-48 w-full" />
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Groups Grid */}
            {!isLoading && groups.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {groups.map((group) => (
                  <Card
                    key={group._id}
                    className="group cursor-pointer overflow-hidden border-border hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,136,0.1)] hover:-translate-y-1"
                    onClick={() => handleNavigateToGroup(group)}
                  >
                    <div className="relative h-48 overflow-hidden">
                      <GroupThumbnail groupId={group._id} groupName={group.name} />
                      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent pt-12">
                        <h3 className="text-white text-xl font-semibold mb-1 truncate drop-shadow-md">{group.name}</h3>
                        <p className="text-sm text-zinc-200 line-clamp-1 drop-shadow-sm font-normal">
                          {group.description || "No description"}
                        </p>
                      </div>
                    </div>
                    <CardContent className="p-3 md:p-4">
                      <div className="space-y-2">
                        {/* Member count and timestamp */}
                        <div className="flex items-center justify-between text-xs md:text-sm gap-2">
                          <div className="flex items-center gap-2 md:gap-3 text-muted-foreground min-w-0">
                            <div
                              className="flex items-center gap-1 shrink-0"
                              aria-label={`${group.members.length} members`}
                            >
                              <Users className="w-4 h-4" aria-hidden="true" />
                              <span>{group.members.length}</span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            {formatDistanceToNow(new Date(group.updatedAt), { addSuffix: true })}
                          </span>
                        </div>

                        {/* Invite Code - Click to reveal and copy */}
                        <div className="flex justify-start">
                          <div
                            className="inline-flex items-center gap-1.5 px-2 py-1.5 md:py-1 bg-muted/50 rounded border border-border cursor-pointer hover:bg-muted/70 transition-colors min-h-[44px] touch-manipulation"
                            onClick={(e) => handleRevealAndCopyInviteCode(group.inviteCode, e)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleRevealAndCopyInviteCode(group.inviteCode, e as any);
                              }
                            }}
                            aria-label="Click to reveal and copy invite code"
                          >
                            {revealedCodes.has(group.inviteCode) ? (
                              <>
                                <span className="text-xs text-muted-foreground shrink-0">Code:</span>
                                <p className="text-xs font-mono text-foreground">
                                  {group.inviteCode}
                                </p>
                                {copiedCode === group.inviteCode ? (
                                  <Check className="w-3 h-3 text-primary shrink-0" aria-hidden="true" />
                                ) : (
                                  <Copy className="w-3 h-3 shrink-0" aria-hidden="true" />
                                )}
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-muted-foreground">Invite Code</span>
                                <Copy className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty State Card */}
            {!isLoading && groups.length === 0 && !error && (
              <Card
                className="border-dashed border-2 border-border hover:border-primary/50 transition-colors cursor-pointer"
                onClick={handleOpenCreateDialog}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenCreateDialog();
                  }
                }}
                aria-label="Create your first group"
              >
                <CardContent className="flex flex-col items-center justify-center py-8 md:py-12 text-center px-4">
                  <div className="bg-primary/10 border border-primary/30 p-3 md:p-4 rounded-full mb-3 md:mb-4" aria-hidden="true">
                    <Plus className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                  </div>
                  <h3 className="text-base md:text-lg mb-2">Create Your First Group</h3>
                  <p className="text-sm md:text-base text-muted-foreground mb-4 max-w-md">
                    Start sharing music with friends, discover new tracks together,
                    and compete on the leaderboard
                  </p>
                  <Button
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10 min-h-[44px]"
                    aria-label="Get started creating a group"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click from firing
                      handleOpenCreateDialog();
                    }}
                  >
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            )}
          </main>

      {/* Create Group Dialog */}
      <CreateGroupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateGroup={createGroup}
      />

      {/* Join Group Dialog */}
      <JoinGroupDialog
        open={isJoinDialogOpen}
        onOpenChange={setIsJoinDialogOpen}
        onJoinGroup={handleJoinGroup}
        isSubmitting={isJoining}
      />
    </>
  );
}
