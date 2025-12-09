import { useState, useEffect } from "react";
import { Settings, Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Label } from "../../ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import { Separator } from "../../ui/separator";
import { Badge } from "../../ui/badge";
import { SidebarTrigger } from "../../ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Group, NavigateFunction } from "../../../types";
import { useGroupSettings } from "../../../hooks/useGroupSettings";
import { useUser } from "../../../contexts/UserContext";

interface GroupSettingsScreenProps {
  group: Group | null;
  onNavigate: NavigateFunction;
}

export default function GroupSettingsScreen({ group, onNavigate }: GroupSettingsScreenProps) {
  const { user } = useUser();
  const ownerId = group?.createdBy?._id || group?.createdBy?.id;
  const groupId = group?._id || '';
  
  const { settings, isLoading, error, fetchSettings, updateSettings, removeMember, isOwner } = useGroupSettings(
    groupId,
    ownerId
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

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
    } catch (err) {
      // Error is already handled by the hook (toast notification)
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMember(memberId);
      setMemberToRemove(null);
      setIsRemoveDialogOpen(false);
    } catch (err) {
      // Error is already handled by the hook (toast notification)
      // Don't close dialog on error so user can retry
      throw err;
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center gap-4 px-4 md:px-6">
          <SidebarTrigger />
            <div className="flex-1 min-w-0">
              <h1 className="truncate">Group Settings</h1>
              <p className="text-sm text-muted-foreground truncate">
                Manage group name, description, and members
              </p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-4 md:p-6 max-w-4xl">
          {/* Error State */}
          {error && (
            <Card className="border-destructive mb-6">
              <CardContent className="p-6">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={() => fetchSettings()} variant="outline">
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {isLoading && !settings && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                  <Skeleton className="h-10 w-24" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Settings Form */}
          {settings && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" aria-hidden="true" />
                    Group Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input
                      id="group-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                      placeholder="Enter group name"
                      aria-label="Group name"
                    />
                    <p className="text-xs text-muted-foreground">
                      {name.length}/100 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="group-description">Description</Label>
                    <Textarea
                      id="group-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={500}
                      placeholder="Enter group description (optional)"
                      rows={4}
                      aria-label="Group description"
                    />
                    <p className="text-xs text-muted-foreground">
                      {description.length}/500 characters
                    </p>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className="w-full sm:w-auto"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </CardContent>
              </Card>

              {/* Members List */}
              <Card>
                <CardHeader>
                  <CardTitle>Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {settings.members.map((member, index) => {
                      const isMemberOwner = ownerId === member.id;
                      const isCurrentUser = user?._id === member.id;

                      return (
                        <div key={member.id}>
                          <div className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Avatar className="border border-border shrink-0">
                                <AvatarImage src={member.profileImage || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {getInitials(member.displayName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">
                                    {member.displayName}
                                  </p>
                                  {isCurrentUser && (
                                    <span className="text-xs text-muted-foreground">(You)</span>
                                  )}
                                  {isMemberOwner && (
                                    <Badge variant="secondary" className="text-xs">
                                      Owner
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Remove button - only show for owner, not for owner themselves */}
                            {isOwner && !isMemberOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                onClick={() => {
                                  setMemberToRemove(member.id);
                                  setIsRemoveDialogOpen(true);
                                }}
                                aria-label={`Remove ${member.displayName} from group`}
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </Button>
                            )}
                          </div>
                          {index < settings.members.length - 1 && <Separator />}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
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
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Remove Member</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to remove <strong>
                      {memberToRemove && settings.members.find(m => m.id === memberToRemove)?.displayName}
                    </strong> from this group? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsRemoveDialogOpen(false);
                      setMemberToRemove(null);
                    }}
                    disabled={isLoading}
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
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isLoading ? 'Removing...' : 'Remove'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </main>
    </>
  );
}

