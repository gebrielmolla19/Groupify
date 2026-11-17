import type { usePaneWidth } from "../../hooks/usePaneWidth";

interface PaneGutterProps {
  separatorProps: ReturnType<typeof usePaneWidth>["separatorProps"];
  label: string;
}

/** The gutter between two desktop panes; drag it or arrow-key it to resize. */
export default function PaneGutter({ separatorProps, label }: PaneGutterProps) {
  return (
    // 8px to look at; 44px to grab on touch screens (CONTRIBUTING §2.4).
    <div
      {...separatorProps}
      aria-label={label}
      className="group relative flex w-2 shrink-0 cursor-col-resize touch-none select-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:before:absolute pointer-coarse:before:inset-y-0 pointer-coarse:before:-inset-x-[18px] pointer-coarse:before:content-['']"
    >
      <span aria-hidden="true" className="h-9 w-0.5 rounded-full bg-line transition-colors group-hover:bg-lit group-focus-visible:bg-iris" />
    </div>
  );
}
