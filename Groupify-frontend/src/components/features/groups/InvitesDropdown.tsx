import { Invite } from '../../../types';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Skeleton } from '../../ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { ScrollArea } from '../../ui/scroll-area';
import { Separator } from '../../ui/separator';
import { Badge } from '../../ui/badge';
import { UserPlus, CheckCircle2, XCircle, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface InvitesDropdownProps {
  invites: Invite[];
  onAcceptInvite: (groupId: string, inviteId: string) => Promise<any>;
  onDeclineInvite: (groupId: string, inviteId: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
  onNavigateToGroup?: (group: any) => void;
}

export default function InvitesDropdown({
  invites,
  onAcceptInvite,
  onDeclineInvite,
  isLoading,
  error,
  onNavigateToGroup,
}: InvitesDropdownProps) {
  const handleAccept = async (invite: Invite) => {
    try {
      const groupId = typeof invite.group === 'string'
        ? invite.group
        : invite.group._id;

      const updatedGroup = await onAcceptInvite(groupId, invite._id);

      // Navigate to the group if callback provided
      if (onNavigateToGroup && updatedGroup) {
        onNavigateToGroup(updatedGroup);
      }
    } catch (error) {
      // Error is already handled by the hook (toast notification)
      logger.error('Failed to accept invite:', error);
    }
  };

  const handleDecline = async (invite: Invite) => {
    try {
      const groupId = typeof invite.group === 'string'
        ? invite.group
        : invite.group._id;

      await onDeclineInvite(groupId, invite._id);
    } catch (error) {
      // Error is already handled by the hook (toast notification)
      logger.error('Failed to decline invite:', error);
    }
  };

  const groupName = (invite: Invite) => {
    if (typeof invite.group === 'string') {
      return 'Group';
    }
    return invite.group.name;
  };

  const inviteCount = invites.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="relative inline-flex">
          <Button
            variant="outline"
            className="border-primary/30 hover:bg-primary hover:text-black hover:border-primary shrink-0 p-2 h-9 w-9"
            aria-label={`View invitations${inviteCount > 0 ? ` (${inviteCount} pending)` : ''}`}
          >
            <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
          </Button>
          {inviteCount > 0 && (
            <span
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive flex items-center justify-center text-[7px] font-semibold text-white leading-none pointer-events-none z-10"
              style={{ fontSize: '10px' }}
            >
              {inviteCount > 9 ? '9+' : inviteCount}
            </span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-96 max-w-md p-0"
        align="center"
        sideOffset={8}
        side="bottom"
      >
        <div className="flex flex-col max-h-[600px]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              <h3 className="font-semibold text-foreground">Group Invitations</h3>
            </div>
            {inviteCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {inviteCount} {inviteCount === 1 ? 'invite' : 'invites'}
              </Badge>
            )}
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : error ? (
                <div className="text-center py-8 px-4">
                  <p className="text-sm text-destructive mb-2">{error}</p>
                  <p className="text-xs text-muted-foreground">
                    Failed to load invitations
                  </p>
                </div>
              ) : inviteCount === 0 ? (
                <div className="text-center py-8 px-4">
                  <UserPlus className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground mb-1">
                    No pending invitations
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You'll see invitations here when someone invites you
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {invites.map((invite, index) => (
                    <div key={invite._id}>
                      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage
                            src={invite.invitedBy.profileImage || undefined}
                            alt={invite.invitedBy.displayName}
                          />
                          <AvatarFallback>
                            {invite.invitedBy.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            <span className="font-semibold">{invite.invitedBy.displayName}</span> invited you
                          </p>
                          <p className="text-sm font-semibold text-primary mt-1">
                            {groupName(invite)}
                          </p>
                          {typeof invite.group !== 'string' && invite.group.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {invite.group.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(invite.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDecline(invite)}
                            className="h-8 w-8 p-0 border-muted-foreground/30 hover:bg-destructive/10 hover:border-destructive/50"
                            aria-label="Decline invite"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAccept(invite)}
                            className="h-8 w-8 p-0 bg-primary hover:bg-primary/90 text-black"
                            aria-label="Accept invite"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {index < invites.length - 1 && (
                        <Separator className="my-2" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

