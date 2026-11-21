import { Button } from "../../ui/button";

interface FeedStatusProps {
  /** The feed's load error, if the last fetch failed. */
  error: string | null;
  isLoading: boolean;
  /** How many shares are on screen. */
  shareCount: number;
  onRetry: () => void;
  /** Opens the invite dialog; the button is hidden without it. */
  onInvite?: () => void;
}

/**
 * The group feed's load error and empty states (#57). A failed load with
 * nothing on screen takes the whole feed; with older shares still shown it
 * is a row above them. A new group with no shares says so.
 */
export default function FeedStatus({ error, isLoading, shareCount, onRetry, onInvite }: FeedStatusProps) {
  if (isLoading) return null;

  if (error && shareCount === 0) {
    return (
      <div role="alert" className="flex max-w-xl flex-col items-start gap-3 py-10">
        <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight">This group didn't load</h2>
        <p className="text-soft">Something went wrong loading it. Your shares are safe. Try again in a moment.</p>
        {/* Outline: the header's Invite is the view's one iris button. */}
        <Button variant="outline" onClick={onRetry}>Try again</Button>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="mb-4 flex max-w-4xl flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm text-soft">
        <span className="flex-1">Couldn't refresh this feed.</span>
        <Button variant="outline" size="sm" className="min-h-11" onClick={onRetry}>Try again</Button>
      </div>
    );
  }

  if (shareCount === 0) {
    return (
      <div className="flex max-w-xl flex-col items-start gap-3 py-10">
        <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight">Nothing shared yet</h2>
        <p className="text-soft">Search for a song above to start the feed. Everyone in the group sees it in their Activity.</p>
        {onInvite && <Button variant="outline" onClick={onInvite}>Invite people first</Button>}
      </div>
    );
  }

  return null;
}
