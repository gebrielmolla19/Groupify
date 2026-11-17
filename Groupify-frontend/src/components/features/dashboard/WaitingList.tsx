import { Link } from "react-router-dom";
import { Music2 } from "lucide-react";
import type { UnheardShares } from "../../../types";
import { formatAge } from "../../../lib/formatTime";

interface WaitingListProps {
  shares: UnheardShares["shares"];
  /** All unheard shares, which can be more than the list shows. */
  total: number;
}

/** Home's list of unheard shares; each row opens the share's group. */
export default function WaitingList({ shares, total }: WaitingListProps) {
  const more = total - shares.length;
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
        <p className="mt-2 pl-5 text-sm text-soft">
          And {more} more in your groups.
        </p>
      )}
    </>
  );
}
