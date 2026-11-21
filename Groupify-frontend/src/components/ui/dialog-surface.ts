import { cn } from "../../lib/utils";

/**
 * The dialog surface, shared with AlertDialogContent (#57). On phones
 * (below md, where the tab bar shows) it is a bottom sheet like the song
 * detail: full width, rounded top, slides up, clear of the home indicator.
 * From md up it is centred and at most 440px wide, never full width.
 */
export const DIALOG_SURFACE_CLASS = cn(
  "bg-popover text-popover-foreground border-hair fixed z-50 grid gap-4 overflow-y-auto border p-6 duration-200",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  // Phone: bottom sheet.
  "inset-x-0 bottom-0 max-h-[90dvh] w-full rounded-t-[20px] border-x-0 border-b-0 pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
  "max-md:data-[state=open]:slide-in-from-bottom max-md:data-[state=closed]:slide-out-to-bottom",
  // Tablet and desktop: centred card.
  "md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:max-h-[calc(100dvh-3rem)] md:w-[calc(100%-2rem)] md:max-w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[20px] md:border md:pb-6",
  "md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
);
