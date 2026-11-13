import { useNavigate } from "react-router-dom";
import { ChevronRight, HelpCircle, ScrollText } from "lucide-react";
import { useChangelogStatus } from "../../../hooks/useChangelogStatus";
import { startTour } from "../onboarding/OnboardingWalkthrough";

const row =
  "flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm font-semibold text-foreground hover:bg-selected/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Tour and What's new, which the desktop rail shows. Phones have no rail,
 * so they live at the bottom of You.
 */
export default function MoreLinks({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { hasUnread } = useChangelogStatus();

  return (
    <nav aria-label="More" className={className}>
      <p aria-hidden="true" className="px-3 pb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-quiet">More</p>
      <button type="button" className={row} onClick={() => startTour()}>
        <HelpCircle className="size-5 shrink-0 text-soft" aria-hidden="true" />
        <span className="flex-1">Take the tour</span>
        <ChevronRight className="size-4 text-quiet" aria-hidden="true" />
      </button>
      <button type="button" className={row} onClick={() => navigate("/changelog")}>
        <ScrollText className="size-5 shrink-0 text-soft" aria-hidden="true" />
        <span className="flex-1">What's new</span>
        {hasUnread && (
          <span className="size-2 rounded-full bg-iris">
            <span className="sr-only">(unread)</span>
          </span>
        )}
        <ChevronRight className="size-4 text-quiet" aria-hidden="true" />
      </button>
    </nav>
  );
}
