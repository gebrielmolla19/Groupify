import { Bell, CheckCircle2, XCircle, Music, UserPlus, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { ScrollArea } from '../../ui/scroll-area';
import { useNotifications } from '../../../hooks/useNotifications';
import { AppNotification } from '../../../types';
import { useNavigate } from 'react-router-dom';

function notificationText(n: AppNotification): string {
  const group = n.metadata?.groupName ?? n.group?.name ?? 'your group';
  if (n.type === 'song_shared') {
    return `shared "${n.metadata?.trackName ?? 'a song'}" in ${group}`;
  }
  if (n.type === 'member_joined') {
    return `joined ${group}`;
  }
  if (n.type === 'group_invite') {
    return `invited you to join ${group}`;
  }
  return 'sent you a notification';
}

function NotificationIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'song_shared') return <Music className="w-3.5 h-3.5 text-primary" />;
  if (type === 'member_joined') return <Users className="w-3.5 h-3.5 text-blue-400" />;
  if (type === 'group_invite') return <UserPlus className="w-3.5 h-3.5 text-violet-400" />;
  return null;
}

export default function NotificationsDropdown() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, acceptInvite, declineInvite } =
    useNotifications();

  const handleAccept = async (n: AppNotification) => {
    const group = await acceptInvite(n);
    if (group) navigate(`/groups/${group._id}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="relative border-primary/30 hover:bg-primary hover:text-black hover:border-primary shrink-0 min-h-[44px] px-2 sm:px-3"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white pointer-events-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <Bell className="w-8 h-8 opacity-20" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="py-1">
              {notifications.map((n) => (
                <div
                  key={n._id}
                  className={`flex gap-3 px-4 py-3 transition-colors ${
                    !n.read ? 'bg-primary/5' : 'hover:bg-muted/40'
                  }`}
                  onClick={() => { if (!n.read && n.type !== 'group_invite') markRead(n._id); }}
                  role={n.type !== 'group_invite' ? 'button' : undefined}
                  style={n.type !== 'group_invite' ? { cursor: 'pointer' } : undefined}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar className="h-8 w-8">
                      {n.actor?.profileImage && (
                        <AvatarImage src={n.actor.profileImage} alt={n.actor.displayName} />
                      )}
                      <AvatarFallback className="text-xs bg-muted">
                        {n.actor?.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5">
                      <NotificationIcon type={n.type} />
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug break-words whitespace-normal">
                      <span className="font-medium">{n.actor?.displayName ?? 'Someone'}</span>{' '}
                      <span className="text-muted-foreground">{notificationText(n)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>

                    {/* Invite actions */}
                    {n.type === 'group_invite' && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-black"
                          onClick={(e) => { e.stopPropagation(); handleAccept(n); }}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs border-muted-foreground/30 hover:bg-destructive/10 hover:border-destructive/50"
                          onClick={(e) => { e.stopPropagation(); declineInvite(n); }}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!n.read && n.type !== 'group_invite' && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
