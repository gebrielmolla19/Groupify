/**
 * Key for Taste Gravity, under the chart: iris is the viewer and their
 * connections, white is everyone else, and a thicker line is a closer match.
 */
export default function TasteGravityLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-soft" aria-label="Chart key">
      <li className="flex items-center gap-2">
        <span className="size-3.5 rounded-full border-2 border-iris" aria-hidden="true" />
        <span className="h-0.5 w-4 rounded-full bg-iris" aria-hidden="true" />
        You and your matches
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3.5 rounded-full border border-line" aria-hidden="true" />
        <span className="h-0.5 w-4 rounded-full bg-quiet" aria-hidden="true" />
        Everyone else
      </li>
      <li className="flex items-center gap-2">
        <span className="h-px w-4 rounded-full bg-quiet" aria-hidden="true" />
        <span className="h-[3px] w-4 rounded-full bg-quiet" aria-hidden="true" />
        Thicker line, closer taste
      </li>
      <li className="flex items-center gap-2">
        <span className="size-2.5 rounded-full border border-line" aria-hidden="true" />
        <span className="size-4 rounded-full border border-line" aria-hidden="true" />
        Bigger circle, more listening
      </li>
    </ul>
  );
}
