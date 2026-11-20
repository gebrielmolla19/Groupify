import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Check, ChevronRight, Copy } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Label } from "../../ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { Skeleton } from "../../ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { useGroupSettings } from "../../../hooks/useGroupSettings";
import { useUser } from "../../../contexts/UserContext";
import { usePlayingGroup } from "../../../contexts/PlayingGroupContext";
import { useGroups } from "../../../hooks/useGroups";
import { logger } from "../../../utils/logger";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import GroupCover from "./GroupCover";
import SettingsSection, { eyebrow } from "../profile/SettingsSection";

export default function GroupSettingsScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { setPlayingGroup } = usePlayingGroup();
  const { groups, fetchGroups } = useGroups();
  
  // Find the group from the groups list
  const group = useMemo(() => groups.find(g => g._id === groupId) || null, [groups, groupId]);
  const ownerId = group?.createdBy?._id || group?.createdBy?.id;
  
  const { settings, isLoading, error, fetchSettings, updateSettings, removeMember, deleteGroup, leaveGroup, isOwner } = useGroupSettings(
    groupId || '',
    ownerId
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (groupId) {
      fetchSettings();
    }
  }, [groupId, fetchSettings]);

  // Update form fields when settings load
  useEffect(() => {
    if (settings) {
      setName(settings.name);
      setDescription(settings.description || '');
      setHasChanges(false);
    }
  }, [settings]);

  // Track form changes
  useEffect(() => {
    if (settings) {
      const nameChanged = name !== settings.name;
      const descriptionChanged = description !== (settings.description || '');
      setHasChanges(nameChanged || descriptionChanged);
    }
  }, [name, description, settings]);

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;

    try {
      setIsSaving(true);
      const updates: { name?: string; description?: string } = {};
      
      if (name !== settings?.name) {
        updates.name = name;
      }
      if (description !== (settings?.description || '')) {
        updates.description = description;
      }

      await updateSettings(updates);
      setHasChanges(false);
      logger.info('Group settings updated:', { groupId, updates });
    } catch (err) {
      // Error is already handled by the hook (toast notification)
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    await removeMember(memberId);
    logger.info('Member removed:', { groupId, memberId });
    setMemberToRemove(null);
    setIsRemoveDialogOpen(false);
  };

  const handleDeleteGroup = async () => {
    const deletedGroupId = groupId;
    const groupName = settings?.name || group?.name || 'Unknown';
    await deleteGroup();

    logger.info('Group deleted:', { groupId: deletedGroupId, groupName });

    // Clear playing group if it's the deleted group
    if (group && group._id === deletedGroupId) {
      setPlayingGroup(null);
    }

    // Refresh groups list to remove deleted group
    await fetchGroups();

    // Close dialog first, then navigate
    setIsDeleteDialogOpen(false);

    // Navigate to dashboard and clear selected group
    navigate('/');
  };

  const handleLeaveGroup = async () => {
    const leftGroupId = groupId;
    const groupName = settings?.name || group?.name || 'Unknown';
    await leaveGroup();
    
    logger.info('Left group:', { groupId: leftGroupId, groupName });
    
    // Clear playing group if it's the group we left
    if (group && group._id === leftGroupId) {
      setPlayingGroup(null);
    }
    
    // Refresh groups list to remove the group we left
    await fetchGroups();
    
    // Navigate to dashboard after successfully leaving
    navigate('/');
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const joinCode = group?.inviteCode;
  const copyJoinCode = async () => {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      toast.success("Join code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error("Failed to copy join code:", err);
      toast.error("Couldn't copy the join code");
    }
  };

  const title = settings?.name || group?.name || "Group settings";
  const memberCount = settings?.members.length ?? group?.members?.length;
  const ownerName = settings?.members.find((m) => m.id === ownerId)?.displayName ?? group?.createdBy?.displayName;
  const sentence = [
    memberCount !== undefined && `${memberCount} ${memberCount === 1 ? "member" : "members"}`,
    isOwner ? "You own this group" : ownerName && `${ownerName} owns this group`,
  ].filter(Boolean).join(" · ");

  const linkRow =
    "flex min-h-[52px] w-full items-center gap-3 border-b border-hair text-left text-base font-semibold text-foreground last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 md:space-y-10">
      <header className="space-y-4 md:space-y-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 min-h-11 min-w-11 shrink-0"
            onClick={() => navigate(`/groups/${groupId}`)}
            aria-label="Back to group feed"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
          <p className={eyebrow}>Group settings</p>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          {groupId && <GroupCover groupId={groupId} className="size-16 shrink-0 rounded-xl md:size-24 md:rounded-2xl" />}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-extrabold leading-tight tracking-tight md:text-5xl">{title}</h1>
            {isLoading && !settings ? (
              <Skeleton className="mt-3 h-4 w-1/2" />
            ) : (
              sentence && <p className="mt-1 text-soft md:mt-2 md:text-lg">{sentence}</p>
            )}
          </div>
        </div>
      </header>

      {/* Phones have no room for the feed header's buttons, so the group's
          other screens are listed here too (#57 phone group menu). */}
      <nav aria-label="Group" className="md:hidden">
        <button type="button" className={linkRow} onClick={() => navigate(`/groups/${groupId}/playlist`)}>
          <span className="flex-1">Playlist</span>
          <ChevronRight className="size-4 text-quiet" aria-hidden="true" />
        </button>
        <button type="button" className={linkRow} onClick={() => navigate(`/groups/${groupId}/analytics`)}>
          <span className="flex-1">Group Dynamics</span>
          <ChevronRight className="size-4 text-quiet" aria-hidden="true" />
        </button>
      </nav>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm text-soft">
          <span className="flex-1">{error}</span>
          <Button variant="outline" size="sm" className="min-h-11" onClick={() => fetchSettings()}>Try again</Button>
        </div>
      )}

      {isLoading && !settings && (
        <div className="grid items-start gap-4 lg:grid-cols-2" aria-hidden="true">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-4 rounded-2xl border border-hair bg-raised p-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      )}

      {settings && (
        <div className="grid items-start gap-8 md:gap-4 lg:grid-cols-2">
          <SettingsSection title="Details">
            <div className="space-y-1.5">
              <Label htmlFor="group-name" className="text-sm font-normal text-soft">Name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Enter group name"
              />
              <p className="text-right font-mono text-[11px] text-quiet">{name.length}/100</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-description" className="text-sm font-normal text-soft">Description</Label>
              <Textarea
                id="group-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                placeholder="What is this group for? (optional)"
                rows={3}
                // The textarea primitive hasn't had the #57 restyle; match Input here.
                className="rounded-lg px-3.5 py-2.5 dark:bg-input-background"
              />
              <p className="text-right font-mono text-[11px] text-quiet">{description.length}/500</p>
            </div>
            <Button variant="outline" className="self-start" onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </SettingsSection>

          <SettingsSection title="Members">
            <ul className="-my-1">
              {settings.members.map((member) => {
                const isMemberOwner = ownerId === member.id;
                const isCurrentUser = user?._id === member.id;
                return (
                  <li key={member.id} className="flex min-h-12 items-center gap-3 py-1">
                    <Avatar className="size-9 shrink-0" aria-hidden="true">
                      <AvatarImage src={member.profileImage || undefined} alt="" className="object-cover" />
                      <AvatarFallback className={cn("text-xs font-bold", isCurrentUser ? "bg-iris text-on-iris" : "bg-selected text-foreground")}>
                        {getInitials(member.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                      {member.displayName}
                      {isCurrentUser && <span className="font-normal text-soft"> (you)</span>}
                    </span>
                    {isMemberOwner && (
                      <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-quiet">Owner</span>
                    )}
                    {/* Only the owner removes members, and never themselves. */}
                    {isOwner && !isMemberOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 shrink-0 text-soft hover:text-danger"
                        onClick={() => {
                          setMemberToRemove(member.id);
                          setIsRemoveDialogOpen(true);
                        }}
                        aria-label={`Remove ${member.displayName} from group`}
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </SettingsSection>

          {joinCode && (
            <SettingsSection title="Join code">
              <div className="flex min-h-[52px] items-center justify-between gap-2 rounded-xl border border-hair bg-background pl-4 pr-1">
                <span className="min-w-0 truncate font-mono text-[15px] tracking-[0.06em]">{joinCode}</span>
                <Button variant="ghost" className="shrink-0 text-iris hover:text-iris" onClick={copyJoinCode} aria-label="Copy join code">
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-sm text-quiet">Anyone with this code can join the group.</p>
            </SettingsSection>
          )}

          {isOwner ? (
            <SettingsSection title="Delete group">
              <p className="text-sm leading-relaxed text-soft">
                Deletes the group for all {settings.members.length} {settings.members.length === 1 ? "member" : "members"}. Its feed, playlist and Group Dynamics go with it, and this can't be undone.
              </p>
              <Button
                variant="outline"
                className="self-start border-danger text-danger hover:bg-danger/10 hover:text-danger"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isLoading}
              >
                Delete group
              </Button>
            </SettingsSection>
          ) : (
            <SettingsSection title="Leave group">
              <p className="text-sm leading-relaxed text-soft">
                Only the owner can delete the group. You can leave it and rejoin later with the join code.
              </p>
              <Button
                variant="outline"
                className="self-start border-danger text-danger hover:bg-danger/10 hover:text-danger"
                onClick={() => setIsLeaveDialogOpen(true)}
                disabled={isLoading}
              >
                Leave group
              </Button>
            </SettingsSection>
          )}
        </div>
      )}

          {/* Remove Member Dialog - Single instance outside the map */}
          {settings && (
            <Dialog open={isRemoveDialogOpen} onOpenChange={(open) => {
              if (!open) {
                setIsRemoveDialogOpen(false);
                setMemberToRemove(null);
              }
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove Member</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to remove <strong>
                      {memberToRemove && settings.members.find(m => m.id === memberToRemove)?.displayName}
                    </strong> from this group? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsRemoveDialogOpen(false);
                      setMemberToRemove(null);
                    }}
                    disabled={isLoading}
                    className="w-full sm:w-auto min-h-[44px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (memberToRemove) {
                        await handleRemoveMember(memberToRemove);
                      }
                    }}
                    disabled={isLoading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto min-h-[44px]"
                  >
                    {isLoading ? 'Removing...' : 'Remove'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Delete Group Dialog - Always render, control visibility with open prop */}
          <AlertDialog 
            open={isDeleteDialogOpen} 
            onOpenChange={(open) => {
              // Always update state - we'll handle preventing close in the onClick handler
              setIsDeleteDialogOpen(open);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Group</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete <strong>{settings?.name}</strong>? This action cannot be undone. All members will be removed from the group and all group data will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async (e) => {
                    // Prevent default close behavior - we'll close manually on success
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      await handleDeleteGroup();
                      // handleDeleteGroup now handles closing the dialog and navigation
                    } catch (err) {
                      // Error is handled by handleDeleteGroup and hook (toast notification)
                      // Dialog stays open so user can retry
                      logger.error('Delete failed:', err);
                      // Don't close dialog on error
                    }
                  }}
                  disabled={isLoading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isLoading ? 'Deleting...' : 'Delete Group'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Leave Group Dialog */}
          <AlertDialog 
            open={isLeaveDialogOpen} 
            onOpenChange={(open) => {
              // If trying to close during loading, prevent it
              if (!open && isLoading) {
                return;
              }
              // Otherwise, update state normally
              setIsLeaveDialogOpen(open);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave Group</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to leave <strong>{settings?.name}</strong>? You can rejoin later using the invite code.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async (e) => {
                    // Prevent default close behavior - we'll close manually on success
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      await handleLeaveGroup();
                      // Only close on success
                      setIsLeaveDialogOpen(false);
                    } catch (err) {
                      // Error is handled by handleLeaveGroup and hook (toast notification)
                      // Dialog stays open so user can retry
                      logger.error('Leave failed:', err);
                      // Don't close dialog on error
                    }
                  }}
                  disabled={isLoading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isLoading ? 'Leaving...' : 'Leave Group'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
    </main>
  );
}
