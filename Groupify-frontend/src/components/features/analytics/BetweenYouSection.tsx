import { useState } from "react";
import { Skeleton } from "../../ui/skeleton";
import { Button } from "../../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { eyebrow } from "../profile/SettingsSection";
import { useBetweenYou } from "../../../hooks/useBetweenYou";
import {
  TASTEMAKER_EMPTY,
  fanEmptyLine,
  fanLine,
  joinNames,
  previousVerdictLine,
  tastemakerLine,
  theyLikedLine,
  verdictLine,
  verdictTitle,
  youLikedLine,
} from "../../../lib/betweenYouCopy";
import type { BetweenYou, BetweenYouMember, ViewerSummaryRange } from "../../../types/analytics";

const card = "flex min-w-0 flex-col gap-1.5 rounded-2xl border border-hair bg-raised p-4 md:p-5";
const cardLabel = "text-sm text-soft";

const initials = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

function MemberAvatar({ member, className = "size-8" }: { member: BetweenYouMember; className?: string }) {
  return (
    <Avatar className={className}>
      {member.profileImage && <AvatarImage src={member.profileImage} alt="" />}
      <AvatarFallback className="bg-hair text-xs text-foreground">{initials(member.displayName)}</AvatarFallback>
    </Avatar>
  );
}

/** A bar filled to `n / total`: iris for the viewer's likes, foreground for the other member's. */
function LikeBar({ n, total, mine }: { n: number; total: number; mine: boolean }) {
  const percent = total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-hair" aria-hidden="true">
      <div className={`h-full rounded-full ${mine ? "bg-iris" : "bg-foreground"}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function MemberPicker({
  members,
  value,
  onChange,
}: {
  members: BetweenYouMember[];
  value: string;
  onChange: (memberId: string) => void;
}) {
  const only = members.length === 1 ? members[0] : null;
  if (only) {
    return (
      <div className="flex min-h-11 items-center gap-2">
        <MemberAvatar member={only} />
        <span className="truncate font-medium text-foreground">{only.displayName}</span>
      </div>
    );
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="min-h-11 w-full max-w-xs border-line bg-background text-base md:text-sm" aria-label="Member to compare with">
        <SelectValue />
      </SelectTrigger>
      {/* Radix caps the list at the viewport and scrolls, so 20+ members fit. */}
      <SelectContent className="max-h-80">
        {members.map((member) => (
          <SelectItem key={member.userId} value={member.userId} className="min-h-11">
            <MemberAvatar member={member} className="size-6" />
            <span className="truncate">{member.displayName}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PairCard({
  data,
  onPick,
  busy,
}: {
  data: BetweenYou;
  onPick: (memberId: string) => void;
  busy: boolean;
}) {
  const pair = data.pair;
  if (!pair) return null;
  const name = data.members.find((m) => m.userId === pair.member)?.displayName ?? "This member";

  return (
    <div className={`${card} gap-3 sm:col-span-2`} aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cardLabel}>You and</span>
        <MemberPicker members={data.members} value={pair.member} onChange={onPick} />
      </div>
      <div className={`flex flex-col gap-1 transition-opacity ${busy ? "opacity-60" : ""}`}>
        <p className="font-display text-2xl font-semibold text-foreground md:text-3xl">{verdictTitle(pair.verdict)}</p>
        <p className="text-sm text-foreground">{verdictLine(pair, name)}</p>
      </div>
      <dl className={`grid gap-3 sm:grid-cols-2 transition-opacity ${busy ? "opacity-60" : ""}`}>
        <div className="flex flex-col gap-1.5">
          <dt className="text-sm text-soft">{youLikedLine(pair, name)}</dt>
          <dd><LikeBar n={pair.youLiked} total={pair.theirShares} mine /></dd>
        </div>
        <div className="flex flex-col gap-1.5">
          <dt className="text-sm text-soft">{theyLikedLine(pair, name)}</dt>
          <dd><LikeBar n={pair.theyLiked} total={pair.yourShares} mine={false} /></dd>
        </div>
      </dl>
      {pair.previousVerdict && (
        <p className="text-xs text-quiet">{previousVerdictLine(data.range, pair.previousVerdict)}</p>
      )}
    </div>
  );
}

/** A small card naming one or more members, with a line from the numbers. */
function PersonCard({
  title,
  people,
  line,
}: {
  title: string;
  people: BetweenYouMember[];
  line: string;
}) {
  return (
    <div className={card}>
      <p className={cardLabel}>{title}</p>
      {people.length > 0 && (
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex shrink-0 -space-x-2">
            {people.slice(0, 3).map((member) => (
              <MemberAvatar key={member.userId} member={member} className="size-8 ring-2 ring-raised" />
            ))}
          </div>
          <p className="min-w-0 break-words font-display text-lg font-semibold text-foreground">
            {joinNames(people.map((m) => m.displayName))}
          </p>
        </div>
      )}
      <p className="text-sm text-soft">{line}</p>
    </div>
  );
}

function BetweenCards({ data, onPick, busy }: { data: BetweenYou; onPick: (id: string) => void; busy: boolean }) {
  if (data.members.length === 0) {
    return (
      <div className={card}>
        <p className="text-sm text-foreground">Between you shows once someone else joins the group.</p>
      </div>
    );
  }
  const byId = new Map(data.members.map((m) => [m.userId, m]));
  const pick = (ids: string[]) => ids.flatMap((id) => byId.get(id) ?? []);
  const fans = data.biggestFan ? pick(data.biggestFan.members) : [];
  const makers = data.tastemaker ? pick(data.tastemaker.members) : [];

  return (
    // One column on phones, where two-up would cut names short; from sm up
    // the fan and tastemaker sit side by side under the pair card.
    <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
      <PairCard data={data} onPick={onPick} busy={busy} />
      <PersonCard
        title="Your biggest fan"
        people={fans}
        line={data.biggestFan ? fanLine(data.biggestFan) : fanEmptyLine(data.pair?.yourShares ?? 0)}
      />
      <PersonCard
        title="Your tastemaker"
        people={makers}
        line={data.tastemaker ? tastemakerLine(data.tastemaker, joinNames(makers.map((m) => m.displayName))) : TASTEMAKER_EMPTY}
      />
    </div>
  );
}

function BetweenSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:gap-4" aria-busy="true" aria-label="Loading Between you">
      <Skeleton className="h-44 rounded-2xl sm:col-span-2" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );
}

/**
 * Group Dynamics, under "You": how the viewer and each other member like and
 * listen to each other's shares. Iris marks the viewer, as everywhere. The
 * period comes from the page's shared control.
 */
export default function BetweenYouSection({ groupId, range }: { groupId: string; range: ViewerSummaryRange }) {
  const [memberId, setMemberId] = useState<string | undefined>(undefined);
  const { data, isLoading, error, errorStatus, refetch } = useBetweenYou(groupId, range, memberId);

  // Until someone is picked, the server chooses the pair, and its choice can
  // differ per period. Keep the member on screen when the period changes, so
  // 7d → 30d compares the same two people. (Set during render, so the fetch
  // for the new period already carries the member.)
  const [shownRange, setShownRange] = useState(range);
  if (range !== shownRange) {
    setShownRange(range);
    if (memberId === undefined && data?.pair) setMemberId(data.pair.member);
  }

  // Only a 400 means the picked member is no longer in the group; after any
  // other failure, try the same member again.
  const tryAgain = () => (errorStatus === 400 && memberId ? setMemberId(undefined) : refetch());

  return (
    <section className="flex flex-col gap-3 md:gap-4" aria-labelledby="between-heading" data-tour="analytics-between">
      <div className="flex min-h-11 items-center px-2">
        <h2 id="between-heading" className={eyebrow}>Between you</h2>
      </div>

      {error ? (
        <div className={`${card} items-start`} role="alert">
          <p className="text-sm text-foreground">Between you didn't load.</p>
          <Button variant="outline" className="min-h-11" onClick={tryAgain}>
            Try again
          </Button>
        </div>
      ) : isLoading && !data ? (
        <BetweenSkeleton />
      ) : data ? (
        <BetweenCards data={data} onPick={setMemberId} busy={isLoading} />
      ) : null}
    </section>
  );
}
