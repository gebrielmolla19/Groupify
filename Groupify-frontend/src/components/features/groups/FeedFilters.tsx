import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { FEED_FILTERS, type FeedFilter } from "../../../lib/feedFilter";

const LABELS: Record<FeedFilter, string> = { all: "All", unheard: "Unheard", yours: "Yours", liked: "Liked" };

/** What an empty filter says instead of showing a blank list. */
export const EMPTY_FILTER_TEXT: Record<Exclude<FeedFilter, "all">, string> = {
  unheard: "You've heard everything. Nice.",
  yours: "You haven't shared a track here yet.",
  liked: "You haven't liked a track here yet.",
};

interface FeedFiltersProps {
  value: FeedFilter;
  counts: Record<FeedFilter, number>;
  onChange: (filter: FeedFilter) => void;
}

/**
 * The feed's filter chips: All, Unheard, Yours, Liked, each with a count.
 * Single-select (radio semantics from Radix); scrolls inside its own row if
 * the chips don't fit.
 */
export default function FeedFilters({ value, counts, onChange }: FeedFiltersProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0 mb-3 md:mb-4">
      <ToggleGroup
        type="single"
        value={value}
        // Radix sends "" when the selected chip is pressed again; keep it selected.
        onValueChange={(next) => next && onChange(next as FeedFilter)}
        // Radix marks single-select items as radios but the root as a plain group.
        role="radiogroup"
        aria-label="Filter shares"
        className="gap-1.5 md:gap-2"
      >
        {FEED_FILTERS.map((filter) => (
          <ToggleGroupItem
            key={filter}
            value={filter}
            className="min-h-11 flex-none gap-1.5 md:gap-2 rounded-xl first:rounded-xl last:rounded-xl border border-line px-2.5 md:px-3.5 text-foreground hover:bg-raised hover:text-foreground data-[state=on]:border-iris data-[state=on]:bg-selected data-[state=on]:text-foreground"
          >
            {LABELS[filter]}
            <span className="font-mono text-xs text-soft">{counts[filter]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
