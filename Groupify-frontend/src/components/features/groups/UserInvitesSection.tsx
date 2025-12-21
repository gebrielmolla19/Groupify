import { Invite } from '../../../types';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Skeleton } from '../../ui/skeleton';
import { UserPlus, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '../../../utils/logger';
import { useNavigate } from 'react-router-dom';

interface UserInvitesSectionProps {
  invites: Invite[];
  onAcceptInvite: (groupId: string, inviteId: string) => Promise<any>;
  onDeclineInvite: (groupId: string, inviteId: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export default function UserInvitesSection({
  invites,
  onAcceptInvite,
  onDeclineInvite,
  isLoading,
  error,
}: UserInvitesSectionProps) {
  const navigate = useNavigate();

  const handleAccept = async (invite: Invite) => {
    try {
      const groupId = typeof invite.group === 'string' 
        ? invite.group 
        : invite.group._id;
      
      const updatedGroup = await onAcceptInvite(groupId, invite._id);
      
      // Navigate to the group
      if (updatedGroup) {
        navigate(`/groups/${updatedGroup._id}`);
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

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Group Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error && !isLoading) {
    return (
      <Card className="mb-6 border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Group Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-sm text-destructive mb-2">
              {error}
            </p>
            <p className="text-xs text-muted-foreground">
              Failed to load invitations. Please refresh the page.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no invites
  if (invites.length === 0 && !isLoading) {
    return (
      <Card className="mb-6 border-dashed border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Group Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <UserPlus className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              No pending invitations
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              You'll see group invitations here when someone invites you
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groupName = (invite: Invite) => {
    if (typeof invite.group === 'string') {
      return 'Group';
    }
    return invite.group.name;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Group Invitations ({invites.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invites.map((invite) => (
            <Card key={invite._id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
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
                      <span className="font-semibold">{invite.invitedBy.displayName}</span> invited you to join
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
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDecline(invite)}
                      className="border-muted-foreground/30 hover:bg-destructive/10 hover:border-destructive/50"
                      aria-label="Decline invite"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAccept(invite)}
                      className="bg-primary hover:bg-primary/90 text-black"
                      aria-label="Accept invite"
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
      </CardContent>
    </Card>
  );
}
