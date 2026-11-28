import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { Skeleton } from "../../ui/skeleton";
import { Button } from "../../ui/button";
import { eyebrow } from "../profile/SettingsSection";
import { useViewerSummary } from "../../../hooks/useViewerSummary";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import {
  bestShareLine,
  discoveryLine,
  formatWait,
  hitRateLine,
  hitRatePercent,
  previousRoleLine,
  reflexLine,
  roleLabel,
  streakLine,
} from "../../../lib/viewerSummaryCopy";
import type { ViewerSummary, ViewerSummaryRange } from "../../../types/analytics";
import { logger } from "../../../utils/logger";

const card = "flex flex-col gap-1.5 rounded-2xl border border-hair bg-raised p-4 md:p-5";
const cardLabel = "text-sm text-soft";
const bigNumber = "font-display text-3xl font-semibold text-foreground";

/** A ring that fills to `percent`, in iris because it's the viewer's number. */
function HitRateRing({ percent }: { percent: number | null }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const filled = percent === null ? 0 : (percent / 100) * circumference;
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="8" className="stroke-hair" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        className="stroke-iris"
      />
    </svg>
  );
}

type YouCard = { key: string; title: string; body: ReactNode; className?: string; wide?: boolean };

/** The six cards, in the order they're swiped through. */
function youCards(data: ViewerSummary, range: ViewerSummaryRange): YouCard[] {
  const percent = hitRatePercent(data.hitRate);
  const reflex = reflexLine(data.reflex);
  const { youPlayMs, groupPlayMs, yoursPlayedMs, groupYoursPlayedMs } = data.reflex;

  return [
    {
      key: "role",
      title: "Your role",
      wide: true,
      body: (
        <>
          <p className={cardLabel}>{roleLabel(range)}</p>
          <p className="font-display text-2xl font-semibold text-iris md:text-3xl">{data.role.title}</p>
          <p className="text-sm text-foreground">{data.role.reason}</p>
          {data.previousRole && (
            <p className="text-xs text-quiet">{previousRoleLine(range, data.previousRole.title)}</p>
          )}
        </>
      ),
    },
    {
      key: "hit-rate",
      title: "Hit rate",
      className: "flex-row items-center gap-4",
      body: (
        <>
          <HitRateRing percent={percent} />
          <div className="flex min-w-0 flex-col gap-1">
            <p className={cardLabel}>Hit rate</p>
            <p className={bigNumber}>{percent === null ? "–" : `${percent}%`}</p>
            <p className="text-sm text-soft">{hitRateLine(data.hitRate)}</p>
          </div>
        </>
      ),
    },
    {
      key: "streak",
      title: "Sharing streak",
      body: (
        <>
          <p className={cardLabel}>Sharing streak</p>
          <p className={bigNumber}>
            {data.streak.longest} {data.streak.longest === 1 ? "day" : "days"}
          </p>
          <p className="text-sm text-soft">{streakLine(data.streak, range)}</p>
        </>
      ),
    },
    {
      key: "best-share",
      title: "Best-landing share",
      body: (
        <>
          <p className={cardLabel}>Your best-landing share</p>
          {data.bestShare ? (
            <>
              <p className="truncate font-display text-xl font-semibold text-foreground">{data.bestShare.trackName}</p>
              <p className="text-sm text-soft">{bestShareLine(data.bestShare)}</p>
            </>
          ) : (
            <p className="text-sm text-soft">None of your shares in this period has a listen or like from others yet.</p>
          )}
        </>
      ),
    },
    {
      key: "discovery",
      title: "Discovery credit",
      body: (
        <>
          <p className={cardLabel}>Discovery credit</p>
          {data.discovery.artists > 0 && <p className={bigNumber}>{data.discovery.artists}</p>}
          <p className="text-sm text-soft">{discoveryLine(data.discovery)}</p>
        </>
      ),
    },
    {
      key: "reflex",
      title: "Your reflex",
      wide: true,
      body: (
        <>
          <p className={cardLabel}>Your reflex</p>
          <dl className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-soft">You listen to others' shares in</dt>
              <dd className="font-mono text-lg text-iris">{youPlayMs === null ? "–" : formatWait(youPlayMs)}</dd>
              {groupPlayMs !== null && <dd className="text-xs text-quiet">Group typical: {formatWait(groupPlayMs)}</dd>}
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-soft">Your shares get listened to in</dt>
              <dd className="font-mono text-lg text-iris">{yoursPlayedMs === null ? "–" : formatWait(yoursPlayedMs)}</dd>
              {groupYoursPlayedMs !== null && (
                <dd className="text-xs text-quiet">Group typical: {formatWait(groupYoursPlayedMs)}</dd>
              )}
            </div>
          </dl>
          <p className="text-sm text-foreground">{reflex ?? "Shows once there are listens to compare."}</p>
        </>
      ),
    },
  ];
}

const NUDGE_STORAGE_KEY = "groupify-you-nudge-seen";

function nudgeSeen(): boolean {
  try {
    return localStorage.getItem(NUDGE_STORAGE_KEY) === "true";
  } catch (error) {
    // Storage blocked (private mode): treat as seen rather than nudge every visit.
    logger.warn("[YouSection] Couldn't read the nudge flag", error);
    return true;
  }
}

function markNudgeSeen() {
  try {
    localStorage.setItem(NUDGE_STORAGE_KEY, "true");
  } catch (error) {
    // Storage blocked: the nudge may show again next visit, which is harmless.
    logger.warn("[YouSection] Couldn't save the nudge flag", error);
  }
}

/** Desktop: the cards in a two-column grid, the role and reflex full width. */
function YouGrid({ cards }: { cards: YouCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((item) => (
        <div key={item.key} className={`${card} ${item.className ?? ""} ${item.wide ? "col-span-2" : ""}`}>
          {item.body}
        </div>
      ))}
    </div>
  );
}

// How far (px) or how fast (px/s) a drag must go to move to another card.
const SWIPE_DISTANCE = 90;
const SWIPE_SPEED = 500;
// Cards behind the top one: each step smaller and lower, so their edges show
// under it. From the fourth card on they sit hidden behind the third. Cards
// stay opaque so one card's text never shows through another; the content of
// the cards behind is dimmed instead (see DeckCard).
const VISIBLE_DEPTH = 3;
const depthStyle = (depth: number) => {
  const step = Math.min(depth, VISIBLE_DEPTH - 1);
  return {
    scale: 1 - step * 0.05,
    y: step * 16,
    opacity: depth < VISIBLE_DEPTH ? 1 : 0,
  };
};

type DeckCardProps = {
  item: YouCard;
  depth: number;
  label: string;
  reduceMotion: boolean;
  onSwipe: (direction: "next" | "prev") => void;
  flingRef?: (fling: () => Promise<void>) => void;
  /** Wiggle left and back once, to show the card can be swiped. */
  nudge: boolean;
  onNudged: () => void;
  /** True while a card is flying off; other moves wait until it lands. */
  flying: React.MutableRefObject<boolean>;
};

/**
 * One card in the deck. Only the top card can be dragged; it tilts as it
 * moves and flies off when swiped far or fast enough.
 */
function DeckCard({ item, depth, label, reduceMotion, onSwipe, flingRef, nudge, onNudged, flying }: DeckCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 0, 240], reduceMotion ? [0, 0, 0] : [-10, 0, 10]);
  const isTop = depth === 0;

  // A card that left the top flew off to the left: once it has faded out at
  // the back, bring it home so it's in place when it comes round again.
  useEffect(() => {
    if (isTop || x.get() === 0) return;
    const controls = animate(x, 0, { duration: 0, delay: reduceMotion ? 0 : 0.3 });
    return () => controls.stop();
  }, [isTop, x, reduceMotion]);

  // Fly off to the left (next card); used by swipes and the keyboard.
  // Ignored while another card is already flying, so a quick → then ← can't
  // leave this card stranded part-way off screen.
  const flyOff = useCallback(async () => {
    if (flying.current) return;
    flying.current = true;
    try {
      if (!reduceMotion) {
        await animate(x, -(window.innerWidth + 40), { duration: 0.25, ease: "easeIn" });
      }
    } finally {
      flying.current = false;
    }
    onSwipe("next");
  }, [x, reduceMotion, onSwipe, flying]);

  useEffect(() => {
    if (isTop) flingRef?.(flyOff);
  }, [isTop, flingRef, flyOff]);

  // Moves the card's own drag position, so the tilt follows as in a real swipe.
  useEffect(() => {
    if (!isTop || !nudge || reduceMotion) return;
    const controls = animate(x, [0, -48, 0], { duration: 0.9, delay: 0.5, ease: "easeInOut" });
    void controls.then(onNudged);
    return () => controls.stop();
  }, [isTop, nudge, reduceMotion, x, onNudged]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_SPEED) {
      void flyOff();
    } else if (!flying.current && (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_SPEED)) {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 32 });
      onSwipe("prev");
    } else {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
    }
  };

  return (
    <motion.div
      className="[grid-area:1/1] origin-bottom"
      style={{ zIndex: 10 - depth }}
      initial={false}
      animate={depthStyle(depth)}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 30 }}
      // Cards behind the top one hold no controls, so hiding them from screen
      // readers is enough; the live region announces the top card.
      aria-hidden={!isTop}
    >
      <motion.div
        role="group"
        aria-roledescription="slide"
        aria-label={label}
        className={`${card} h-full select-none *:transition-opacity *:duration-300 ${item.className ?? ""} ${
          isTop ? "cursor-grab active:cursor-grabbing" : "*:opacity-30"
        }`}
        style={{ x, rotate, touchAction: "pan-y" }}
        drag={isTop ? "x" : false}
        dragSnapToOrigin={false}
        dragElastic={0.9}
        dragMomentum={false}
        onDragEnd={onDragEnd}
      >
        {item.body}
      </motion.div>
    </motion.div>
  );
}

/**
 * Phones: the cards in a stacked deck. Swipe the top card left for the next
 * one, right for the previous one; the deck goes round.
 */
function YouDeck({ cards }: { cards: YouCard[] }) {
  const [top, setTop] = useState(0);
  const reduceMotion = useReducedMotion() ?? false;
  const scope = useRef<HTMLDivElement>(null);
  const [nudge, setNudge] = useState(false);
  const flingTop = useRef<() => Promise<void>>();
  const flying = useRef(false);
  const count = cards.length;

  // Any move ends the nudge for good, so it never replays when card 1 comes
  // back to the top.
  const onSwipe = useCallback(
    (direction: "next" | "prev") => {
      setNudge(false);
      setTop((t) => (direction === "next" ? (t + 1) % count : (t - 1 + count) % count));
    },
    [count],
  );
  const onNudged = useCallback(() => setNudge(false), []);
  const setFling = useCallback((fling: () => Promise<void>) => {
    flingTop.current = fling;
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      void flingTop.current?.();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (!flying.current) onSwipe("prev");
    }
  };

  // Once ever, when the deck first comes into view, wiggle the top card to
  // the left and back, so it's clear it can be swiped.
  useEffect(() => {
    const root = scope.current;
    if (!root || nudgeSeen()) return;
    if (reduceMotion) {
      markNudgeSeen();
      return;
    }
    let cancelled = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || cancelled) return;
        observer.disconnect();
        markNudgeSeen();
        setNudge(true);
      },
      { threshold: 0.6 },
    );
    observer.observe(root);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [reduceMotion]);

  const current = cards[top] ?? cards[0];

  return (
    <div ref={scope} className="flex flex-col gap-3">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Your numbers"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="grid rounded-2xl pb-8 outline-none focus-visible:ring-2 focus-visible:ring-iris"
      >
        {cards.map((item, i) => (
          <DeckCard
            key={item.key}
            item={item}
            depth={(i - top + count) % count}
            label={`${i + 1} of ${count}: ${item.title}`}
            reduceMotion={reduceMotion}
            onSwipe={onSwipe}
            flingRef={i === top ? setFling : undefined}
            nudge={nudge && i === 0}
            onNudged={onNudged}
            flying={flying}
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
        {cards.map((item, i) => (
          <span
            key={item.key}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === top ? "w-5 bg-iris" : "w-1.5 bg-hair"}`}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Card {top + 1} of {count}: {current.title}
      </p>
    </div>
  );
}

function YouCards({ data, range }: { data: ViewerSummary; range: ViewerSummaryRange }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const cards = youCards(data, range);
  return isDesktop ? <YouGrid cards={cards} /> : <YouDeck cards={cards} />;
}

function YouSkeleton() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  return isDesktop ? (
    <div className="grid grid-cols-2 gap-4" aria-busy="true" aria-label="Loading your numbers">
      <Skeleton className="col-span-2 h-32 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
    </div>
  ) : (
    <div className="grid pb-8" aria-busy="true" aria-label="Loading your numbers">
      {[
        { key: "back", style: "translate-y-8 scale-90" },
        { key: "middle", style: "translate-y-4 scale-95" },
        { key: "top", style: "" },
      ].map((layer) => (
        <Skeleton key={layer.key} className={`[grid-area:1/1] h-40 origin-bottom rounded-2xl ${layer.style}`} />
      ))}
    </div>
  );
}

/**
 * The top of Group Dynamics: the signed-in member's own numbers for the
 * period chosen in the page header. Iris marks the viewer, as everywhere in
 * the app.
 */
export default function YouSection({ groupId, range }: { groupId: string; range: ViewerSummaryRange }) {
  // While a new range loads the old numbers stay, so the phone deck stays
  // mounted and keeps its current card on top.
  const { data, isLoading, error, refetch } = useViewerSummary(groupId, range);

  return (
    <section className="flex flex-col gap-3 md:gap-4" aria-labelledby="you-heading" data-tour="analytics-you">
      <div className="flex min-h-11 items-center px-2">
        <h2 id="you-heading" className={eyebrow}>You</h2>
      </div>

      {error ? (
        <div className={`${card} items-start`} role="alert">
          <p className="text-sm text-foreground">Your numbers didn't load.</p>
          <Button variant="outline" className="min-h-11" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading && !data ? (
        <YouSkeleton />
      ) : data ? (
        <YouCards data={data} range={data.range} />
      ) : null}
    </section>
  );
}
