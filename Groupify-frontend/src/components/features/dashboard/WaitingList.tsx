import { Link } from "react-router-dom";
import { Music2 } from "lucide-react";
import type { Group, UnheardShares } from "../../../types";
import { formatAge } from "../../../lib/formatTime";

interface WaitingListProps {
  shares: UnheardShares["shares"];
  /** All unheard shares, which can be more than the list shows. */
  total: number;
  byGroup: UnheardShares["byGroup"];
  /** The viewer's groups, for the names on the per-group links. */
  groups: Group[];
}

/**
 * Home's newest unheard shares; each row opens the share's group. When there
 * are more than it shows, links per group open each feed on its Unheard filter.
 */
export default function WaitingList({ shares, total, byGroup, groups }: WaitingListProps) {
  const more = total - shares.length;
  const perGroup = groups
    .filter((group) => byGroup[group._id] > 0)
    .map((group) => ({ group, count: byGroup[group._id] }))
    .sort((a, b) => b.count - a.count);
  return (
    <>
      <ul aria-label="Waiting for you" className="@container space-y-1">
        {shares.map((share) => {
          const meta = `${share.group.name} · ${share.sharedBy.displayName} · ${formatAge(Date.now() - new Date(share.createdAt).getTime())}`;
          return (
            <li key={share._id}>
              <Link
                to={`/groups/${share.group._id}`}
                className="relative flex min-h-11 items-center gap-3 rounded-xl py-2 pl-5 pr-2 outline-none transition-colors hover:bg-selected/60 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden="true" className="absolute left-1.5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-iris" />
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-selected">
                  {share.trackImage ? (
                    <img src={share.trackImage} alt="" className="size-full object-cover" />
                  ) : (
                    <Music2 className="size-5 text-quiet" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-foreground">{share.trackName}</span>
                  <span className="block truncate text-sm text-soft">{share.artistName}</span>
                  <span className="block truncate font-mono text-[11px] text-quiet @xl:hidden">{meta}</span>
                </span>
                <span className="hidden max-w-[45%] shrink-0 truncate font-mono text-xs text-quiet @xl:block">{meta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {more > 0 && (
        <div className="mt-4 pl-5">
          <p className="text-sm text-soft">And {more} more.{perGroup.length > 0 && " Hear them group by group:"}</p>
          {perGroup.length > 0 && (
          <ul aria-label="Unheard by group" className="mt-2 flex flex-wrap gap-2">
            {perGroup.map(({ group, count }) => (
              <li key={group._id} className="min-w-0 max-w-full">
                <Link
                  to={`/groups/${group._id}?filter=unheard`}
                  className="flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate">{group.name}</span>
                  <span className="font-mono text-xs text-soft">{count}</span>
                  <span className="sr-only">unheard</span>
                </Link>
              </li>
            ))}
          </ul>
          )}
        </div>
      )}
    </>
  );
}
