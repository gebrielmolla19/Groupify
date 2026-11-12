import { Sidebar, useSidebar } from "../ui/sidebar";
import AppRail from "./AppRail";
import type { usePaneWidth } from "../../hooks/usePaneWidth";

/** Below this width the rail shows covers and icons only. */
export const RAIL_COMPACT_BELOW = 160;

interface AppSidebarProps {
  rail: ReturnType<typeof usePaneWidth>;
}

/**
 * Desktop: the rail pane plus the gutter that resizes it.
 * Phone: the same rail contents in a slide-out sheet, until the phone tab
 * bar replaces it (#57 slice 3b).
 */
export default function AppSidebar({ rail }: AppSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    return (
      <Sidebar>
        <AppRail compact={false} onNavigate={() => setOpenMobile(false)} />
      </Sidebar>
    );
  }

  return (
    <>
      <aside aria-label="Sidebar" className="h-full shrink-0 overflow-hidden rounded-2xl bg-pane" style={{ width: rail.width }}>
        <AppRail compact={rail.width < RAIL_COMPACT_BELOW} />
      </aside>
      {/* 8px to look at; 44px to grab on touch screens (CONTRIBUTING §2.4). */}
      <div
        {...rail.separatorProps}
        aria-label="Resize sidebar"
        className="group relative flex w-2 shrink-0 cursor-col-resize touch-none select-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:before:absolute pointer-coarse:before:inset-y-0 pointer-coarse:before:-inset-x-[18px] pointer-coarse:before:content-['']"
      >
        <span aria-hidden="true" className="h-9 w-0.5 rounded-full bg-line transition-colors group-hover:bg-lit group-focus-visible:bg-iris" />
      </div>
    </>
  );
}
