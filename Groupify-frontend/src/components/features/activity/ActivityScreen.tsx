import { useNavigate } from "react-router-dom";
import { Button } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { useNotifications } from "../../../hooks/useNotifications";
import { useGroups } from "../../../hooks/useGroups";
import { formatAge } from "../../../lib/formatTime";
import { cn } from "../../../lib/utils";
import type { AppNotification } from "../../../types";

const DAY = 86_400_000;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const groupName = (n: AppNotification) => n.metadata?.groupName ?? n.group?.name ?? "your group";
const actorName = (n: AppNotification) => n.actor?.displayName ?? "Someone";

/** What happened, after the actor's name. */
function what(n: AppNotification) {
  if (n.type === "song_shared") return `shared ${n.metadata?.trackName ?? "a track"}`;
  if (n.type === "member_joined") return "joined";
  return `invited you to ${groupName(n)}`;
}

/** "1 invite, 2 new tracks and 1 new member." for the unread ones. */
function summary(unread: AppNotification[]) {
  const count = (type: AppNotification["type"]) => unread.filter((n) => n.type === type).length;
  const parts = [
    count("group_invite") && plural(count("group_invite"), "invite", "invites"),
    count("song_shared") && plural(count("song_shared"), "new track", "new tracks"),
    count("member_joined") && plural(count("member_joined"), "new member", "new members"),
  ].filter(Boolean) as string[];
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}.` : `${parts[0]}.`;
}

/**
 * Activity (#57 slice 7): what happened in the viewer's groups. Says what is
 * new, then lists it by age. Shares and joins open their group; invites are
 * answered in place.
 */
export default function ActivityScreen() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, error, refetch, markRead, markAllRead, acceptInvite, declineInvite } = useNotifications();
  const { refetch: refetchGroups } = useGroups();
  const unread = notifications.filter((n) => !n.read);
  const firstLoad = loading && notifications.length === 0;

  const headline = notifications.length === 0 ? "No activity yet" : unreadCount > 0 ? plural(unreadCount, "new thing", "new things") : "You're all caught up";
  const sentence = notifications.length === 0
    ? "When someone in your groups shares a track or joins, it shows up here."
    : unreadCount > 0 ? summary(unread) : "Nothing new in your groups.";

  const open = (n: AppNotification) => {
    if (!n.read) markRead(n._id);
    if (n.group?._id) navigate(`/groups/${n.group._id}`);
  };
  const accept = async (n: AppNotification) => {
    const group = await acceptInvite(n);
    if (!group) return;
    // Load the joined group into the rail and the group screen before opening it.
    await refetchGroups();
    navigate(`/groups/${group._id}`);
  };

  const now = Date.now();
  const age = (n: AppNotification) => now - new Date(n.createdAt).getTime();
  // Today is the calendar day; this week is the rest of the last seven days.
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const bucket = (n: AppNotification) =>
    new Date(n.createdAt).getTime() >= startOfToday ? "Today" : age(n) < 7 * DAY ? "This week" : "Earlier";
  const sections = (["Today", "This week", "Earlier"] as const)
    .map((label) => ({ label, items: notifications.filter((n) => bucket(n) === label) }))
    .filter((s) => s.items.length > 0);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 md:space-y-8">
      <header>
        <div className="flex min-h-11 items-center gap-3">
          <p className="flex-1 font-mono text-xs uppercase tracking-[0.2em] text-quiet">Activity</p>
          {unreadCount > 0 && (
            <Button variant="outline" className="min-h-11 shrink-0" onClick={markAllRead}>Mark all read</Button>
          )}
        </div>
        {firstLoad ? (
          <>
            <Skeleton className="mt-3 h-9 w-2/3 md:h-12" />
            <Skeleton className="mt-3 h-4 w-1/2" />
          </>
        ) : error && notifications.length === 0 ? (
          <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">Activity</h1>
        ) : (
          <>
            <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{headline}</h1>
            <p className="mt-2 text-soft md:text-lg">{sentence}</p>
          </>
        )}
      </header>

      {error && !loading && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm text-soft">
          <span className="flex-1">Couldn't load your activity.</span>
          <Button variant="outline" size="sm" className="min-h-11" onClick={refetch}>Try again</Button>
        </div>
      )}

      {firstLoad && (
        <div className="space-y-3" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 pl-5">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {sections.map(({ label, items }) => (
        <section key={label} aria-label={label}>
          <h2 className="mb-2 pl-5 font-mono text-[11px] uppercase tracking-[0.15em] text-quiet">{label}</h2>
          <ul className="-mx-2 md:mx-0">
            {items.map((n) => (
              <ActivityRow key={n._id} n={n} ago={formatAge(age(n))} onOpen={() => open(n)} onAccept={() => accept(n)} onDecline={() => declineInvite(n)} />
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

interface ActivityRowProps {
  n: AppNotification;
  ago: string;
  onOpen: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

function ActivityRow({ n, ago, onOpen, onAccept, onDecline }: ActivityRowProps) {
  const isInvite = n.type === "group_invite";
  const body = (
    <>
      {!n.read && <span aria-hidden="true" className={cn("absolute left-1.5 size-2 rounded-full bg-iris", isInvite ? "top-[30px]" : "top-1/2 -translate-y-1/2")} data-testid="unread-dot" />}
      <Avatar className="size-10 shrink-0" aria-hidden="true">
        <AvatarImage src={n.actor?.profileImage || undefined} alt="" className="object-cover" />
        <AvatarFallback className="bg-selected text-sm font-semibold text-foreground">{actorName(n).charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className={cn("line-clamp-2 text-foreground", n.read ? "font-medium" : "font-bold")}>
          {actorName(n)} <span className={cn("text-soft", n.read ? "font-normal" : "font-medium")}>{what(n)}</span>
          {!n.read && <span className="sr-only"> (new)</span>}
        </span>
        <span className="mt-0.5 flex gap-1 whitespace-nowrap font-mono text-[11px] text-quiet">
          {!isInvite && <span className="min-w-0 truncate">{groupName(n)} ·</span>}
          <span className="shrink-0">{ago}</span>
        </span>
      </span>
    </>
  );

  if (!isInvite) {
    return (
      <li>
        <button
          type="button"
          onClick={onOpen}
          className="relative flex min-h-14 w-full items-center gap-3 rounded-xl py-2 pl-5 pr-2 text-left transition-colors hover:bg-selected/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </button>
      </li>
    );
  }
  return (
    <li className="relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl py-2 pl-5 pr-2">
      {body}
      <span className="flex w-full gap-2 pl-[52px] sm:w-auto sm:pl-0">
        <Button className="min-h-11" onClick={onAccept} aria-label={`Accept invite to ${groupName(n)}`}>Accept</Button>
        <Button variant="outline" className="min-h-11" onClick={onDecline} aria-label={`Decline invite to ${groupName(n)}`}>Decline</Button>
      </span>
    </li>
  );
}
