
import { Invite } from '../../../types';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Skeleton } from '../../ui/skeleton';
import { UserPlus, CheckCircle2, XCircle } from 'lucide-react';
import { useUser } from '../../../contexts/UserContext';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '../../../utils/logger';

interface InvitesListProps {
  groupId: string;
  invites: Invite[];
  onAcceptInvite: (groupId: string, inviteId: string) => Promise<any>;
  onDeclineInvite?: (groupId: string, inviteId: string) => Promise<void>;
  isLoading: boolean;
}

export default function InvitesList({
  groupId,
  invites,
  onAcceptInvite,
  onDeclineInvite,
  isLoading,
}: InvitesListProps) {
  const { user } = useUser();

  // Filter pending invites
  const pendingInvites = invites.filter(invite => invite.status === 'pending');

  // Filter invites where current user is the invited user
  const receivedInvites = pendingInvites.filter(
    invite => invite.invitedUser._id === user?._id
  );

  // Filter invites sent by current user or for group members to see
  const sentInvites = pendingInvites.filter(
    invite => invite.invitedUser._id !== user?._id
  );

  const handleAccept = async (inviteId: string) => {
    try {
      await onAcceptInvite(groupId, inviteId);
    } catch (error) {
      // Error is already handled by the hook (toast notification)
      logger.error('Failed to accept invite:', error);
    }
  };

  const handleDecline = async (inviteId: string) => {
    if (!onDeclineInvite) return;
    try {
      await onDeclineInvite(groupId, inviteId);
    } catch (error) {
      // Error is already handled by the hook (toast notification)
      logger.error('Failed to decline invite:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (pendingInvites.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <UserPlus className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No pending invites</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Received Invites - Invites for current user */}
      {receivedInvites.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground mb-2">Invites for You</h3>
          {receivedInvites.map((invite) => (
            <Card key={invite._id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
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
                      <p className="text-sm font-medium text-foreground truncate">
                        {invite.invitedBy.displayName} invited you
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(invite.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {onDeclineInvite && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDecline(invite._id)}
                        className="border-muted-foreground/30 hover:bg-destructive/10 hover:border-destructive/50"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleAccept(invite._id)}
                      className="bg-primary hover:bg-primary/90 text-black"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Accept
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sent Invites - Invites sent by current user or visible to group members */}
      {sentInvites.length > 0 && (
        <div className="space-y-2">
          {receivedInvites.length > 0 && (
            <h3 className="text-sm font-semibold text-foreground mb-2">Pending Invites</h3>
          )}
          {sentInvites.map((invite) => (
            <Card key={invite._id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={invite.invitedUser.profileImage || undefined}
                      alt={invite.invitedUser.displayName}
                    />
                    <AvatarFallback>
                      {invite.invitedUser.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {invite.invitedUser.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Invited {formatDistanceToNow(new Date(invite.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-card rounded">
                    Pending
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

