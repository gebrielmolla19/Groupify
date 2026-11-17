import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePaneWidth } from "../../hooks/usePaneWidth";
import PaneGutter from "./PaneGutter";

/** Where the desktop layout puts the detail pane: right of the content pane. */
export const DetailPaneSlot = createContext<HTMLElement | null>(null);

/**
 * The third desktop pane (#57 "Panes, not pages"), beside the content pane,
 * with a gutter on its left edge to resize it. A screen renders this while it
 * has something to show in detail; the pane goes away when it unmounts.
 */
export default function DetailPane({ label, children }: { label: string; children: ReactNode }) {
  const slot = useContext(DetailPaneSlot);
  const pane = usePaneWidth({ storageKey: "groupify-detail-width", initial: 360, min: 300, max: 520, edge: "left" });
  if (!slot) return null;
  return createPortal(
    <>
      <PaneGutter separatorProps={pane.separatorProps} label="Resize details" />
      <aside
        aria-label={label}
        className="h-full shrink-0 overflow-y-auto rounded-2xl bg-pane [--background:var(--pane)] [--card:var(--raised)]"
        style={{ width: pane.width }}
      >
        {children}
      </aside>
    </>,
    slot,
  );
}
