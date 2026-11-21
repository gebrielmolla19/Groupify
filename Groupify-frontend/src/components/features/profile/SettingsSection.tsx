import { useId, type ReactNode } from "react";
import { cn } from "../../../lib/utils";

/**
 * One block of a settings screen (Profile, Group settings). On desktop it's a
 * raised card with a bold title; on phones the card chrome goes and the title
 * is a small mono label, so the screen reads as one list (#57 mocks).
 */
export default function SettingsSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn("flex flex-col gap-3 md:gap-4 md:rounded-2xl md:border md:border-hair md:bg-raised md:p-5", className)}
    >
      <h2
        id={id}
        className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-quiet md:font-sans md:text-base md:font-bold md:normal-case md:tracking-normal md:text-foreground"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The small mono label above a settings screen's headline. */
export const eyebrow = "font-mono text-xs uppercase tracking-[0.2em] text-quiet";
