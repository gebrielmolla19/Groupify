import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../../ui/dropdown-menu';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { ScrollArea } from '../../ui/scroll-area';
import { useNotifications } from '../../../hooks/useNotifications';
import { AppNotification } from '../../../types';

function notificationText(n: AppNotification): string {
  if (n.type === 'song_shared') {
    const actor = n.actor?.displayName ?? 'Someone';
    const track = n.metadata?.trackName ?? 'a song';
    const group = n.metadata?.groupName ?? n.group?.name ?? 'your group';
    return `${actor} shared "${track}" in ${group}`;
  }
  if (n.type === 'member_joined') {
    const member = n.metadata?.memberName ?? 'Someone';
    const group = n.metadata?.groupName ?? n.group?.name ?? 'your group';
    return `${member} joined ${group}`;
  }
  return 'New notification';
}

export default function NotificationsDropdown() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

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
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* List */}
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <ScrollArea className="max-h-[360px]">
            {notifications.map((n, index) => (
              <div key={n._id}>
                <DropdownMenuItem
                  className={`flex gap-3 px-4 py-3 cursor-pointer focus:bg-muted/50 ${
                    !n.read ? 'bg-primary/5' : ''
                  }`}
                  onSelect={() => { if (!n.read) markRead(n._id); }}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {n.actor?.profileImage && (
                      <AvatarImage src={n.actor.profileImage} alt={n.actor.displayName} />
                    )}
                    <AvatarFallback className="text-xs bg-muted">
                      {n.actor?.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug text-foreground break-words whitespace-normal">
                      {notificationText(n)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  {!n.read && (
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
                  )}
                </DropdownMenuItem>
                {index < notifications.length - 1 && (
                  <DropdownMenuSeparator className="my-0" />
                )}
              </div>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
