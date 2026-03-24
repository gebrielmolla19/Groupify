import { Bell, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { useNotifications } from '../../../hooks/useNotifications';
import { AppNotification } from '../../../types';
import { useNavigate } from 'react-router-dom';

function notificationText(n: AppNotification): string {
  const group = n.metadata?.groupName ?? n.group?.name ?? 'your group';
  if (n.type === 'song_shared') return `shared "${n.metadata?.trackName ?? 'a song'}" in ${group}`;
  if (n.type === 'member_joined') return `joined ${group}`;
  if (n.type === 'group_invite') return `invited you to join ${group}`;
  return 'sent you a notification';
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function NotificationsDropdown() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, acceptInvite, declineInvite } =
    useNotifications();

  // Show unread notifications always; read notifications only within the past week
  const visibleNotifications = notifications.filter(
    (n) => !n.read || Date.now() - new Date(n.createdAt).getTime() < ONE_WEEK_MS
  );

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

      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="p-0 flex flex-col"
        style={{
          width: window.innerWidth < 640 ? 'calc(100vw - 1rem)' : '20rem',
          maxHeight: 'min(400px, 60dvh)',
          overflow: 'hidden',
        }}
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
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

        {/* Empty state */}
        {visibleNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <Bell className="w-8 h-8 opacity-20" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {visibleNotifications.map((n, i) => (
              <div key={n._id}>
                {/* Row */}
                <div
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    !n.read ? 'bg-primary/5' : 'hover:bg-muted/30'
                  } ${n.type !== 'group_invite' ? 'cursor-pointer' : ''}`}
                  onClick={() => { if (!n.read && n.type !== 'group_invite') markRead(n._id); }}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    {n.actor?.profileImage && (
                      <AvatarImage src={n.actor.profileImage} alt={n.actor.displayName} />
                    )}
                    <AvatarFallback className="text-xs">
                      {n.actor?.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug line-clamp-2">
                      <span className="font-semibold">{n.actor?.displayName ?? 'Someone'}</span>{' '}
                      <span className="text-muted-foreground">{notificationText(n)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>

                    {n.type === 'group_invite' && (
                      <div className="flex gap-2 mt-2.5">
                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-black gap-1"
                          onClick={(e) => { e.stopPropagation(); handleAccept(n); }}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-3 text-xs text-muted-foreground hover:text-destructive gap-1"
                          onClick={(e) => { e.stopPropagation(); declineInvite(n); }}
                        >
                          <XCircle className="w-3 h-3" /> Decline
                        </Button>
                      </div>
                    )}
                  </div>

                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>

                {/* Divider between items */}
                {i < visibleNotifications.length - 1 && (
                  <div className="mx-4 border-b border-border/50" />
                )}
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
