import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { ANALYTICS_RANGES, type AnalyticsRange } from "../../../types/analytics";

const LABELS: Record<AnalyticsRange, string> = { "7d": "7d", "30d": "30d", all: "All" };

/**
 * The one period control on Group Dynamics. Every section on the page shows
 * the period chosen here; the selected chip is iris.
 */
export default function AnalyticsRangeControl({
  value,
  onChange,
}: {
  value: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      // Radix sends "" when the selected chip is pressed again; keep it selected.
      onValueChange={(next) => next && onChange(next as AnalyticsRange)}
      role="radiogroup"
      aria-label="Period for Group Dynamics"
      className="shrink-0 gap-1.5"
    >
      {ANALYTICS_RANGES.map((range) => (
        <ToggleGroupItem
          key={range}
          value={range}
          className="min-h-11 min-w-11 flex-none rounded-xl first:rounded-xl last:rounded-xl border border-line px-3 font-mono text-xs text-foreground hover:bg-raised hover:text-foreground data-[state=on]:border-iris data-[state=on]:bg-selected data-[state=on]:text-foreground"
        >
          {LABELS[range]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
