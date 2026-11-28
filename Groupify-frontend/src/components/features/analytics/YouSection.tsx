import { useEffect, useState, type ReactNode } from "react";
import { useAnimate, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Skeleton } from "../../ui/skeleton";
import { Button } from "../../ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "../../ui/carousel";
import { cardTween, visibleFraction } from "../../../lib/carouselTween";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { eyebrow } from "../profile/SettingsSection";
import { useViewerSummary } from "../../../hooks/useViewerSummary";
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

const RANGES: { value: ViewerSummaryRange; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

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

type YouCard = { key: string; title: string; body: ReactNode; className?: string };

/** The six cards, in the order they're swiped through. */
function youCards(data: ViewerSummary, range: ViewerSummaryRange): YouCard[] {
  const percent = hitRatePercent(data.hitRate);
  const reflex = reflexLine(data.reflex);
  const { youPlayMs, groupPlayMs, yoursPlayedMs, groupYoursPlayedMs } = data.reflex;

  return [
    {
      key: "role",
      title: "Your role",
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

// One card and the next one's edge on a phone; two and a bit on desktop.
const slideBasis = "basis-[82%] md:basis-[47%]";
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

/**
 * Scales and dims each card by how much of it is in view, on every scroll
 * frame, so the effect follows the finger. Writes styles directly instead of
 * through React state to avoid a re-render per frame.
 */
function useCardTween(api: CarouselApi | undefined, enabled: boolean) {
  useEffect(() => {
    if (!api) return;
    const cards = () => api.slideNodes().map((slide) => slide.querySelector<HTMLElement>("[data-you-card]"));

    if (!enabled) {
      cards().forEach((card) => card?.style.removeProperty("transform"));
      cards().forEach((card) => card?.style.removeProperty("opacity"));
      return;
    }

    const apply = () => {
      // Read every position first, then write every style, so the browser
      // lays out once per frame instead of once per card.
      const viewport = api.rootNode().getBoundingClientRect();
      const tweens = api.slideNodes().map((slide) => {
        const frame = slide.querySelector<HTMLElement>("[data-you-frame]");
        const card = slide.querySelector<HTMLElement>("[data-you-card]");
        return frame && card ? { card, ...cardTween(visibleFraction(frame.getBoundingClientRect(), viewport)) } : null;
      });
      tweens.forEach((tween) => {
        if (!tween) return;
        tween.card.style.transform = `scale(${tween.scale})`;
        tween.card.style.opacity = String(tween.opacity);
      });
    };

    apply();
    api.on("scroll", apply).on("reInit", apply).on("resize", apply);
    return () => {
      api.off("scroll", apply).off("reInit", apply).off("resize", apply);
    };
  }, [api, enabled]);
}

function YouCarousel({ data, range }: { data: ViewerSummary; range: ViewerSummaryRange }) {
  const cards = youCards(data, range);
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [snapCount, setSnapCount] = useState(cards.length);
  // The cards fully in view: one on a phone, two on desktop.
  const [inView, setInView] = useState<number[]>([0]);
  const reduceMotion = useReducedMotion() ?? false;
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useCardTween(api, !reduceMotion);

  useEffect(() => {
    if (!api) return;
    const sync = () => {
      setSelected(api.selectedScrollSnap());
      setSnapCount(api.scrollSnapList().length);
    };
    const syncInView = () => {
      const visible = api.slidesInView();
      if (visible.length > 0) setInView(visible);
    };
    sync();
    syncInView();
    api.on("select", sync).on("reInit", sync).on("slidesInView", syncInView);
    return () => {
      api.off("select", sync).off("reInit", sync).off("slidesInView", syncInView);
    };
  }, [api]);

  // Once ever, when the cards first come into view, slide them a little to
  // the left and back, so it's clear there's more to swipe to.
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
        animate("[data-you-frame]", { x: [0, -36, 0] }, { duration: 0.9, delay: 0.5, ease: "easeInOut" });
      },
      { threshold: 0.6 },
    );
    observer.observe(root);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [scope, animate, reduceMotion]);

  // On desktop the last stop shows two cards, so announce what's in view
  // rather than the stop number.
  const shown = inView.map((i) => cards[i]).filter((c): c is YouCard => Boolean(c));
  const announcement =
    shown.length > 1
      ? `Cards ${inView[0] + 1} to ${inView[inView.length - 1] + 1} of ${cards.length}: ${shown.map((c) => c.title).join(", ")}`
      : `Card ${(inView[0] ?? 0) + 1} of ${cards.length}: ${(shown[0] ?? cards[0]).title}`;

  return (
    <div ref={scope} className="flex flex-col gap-3">
      <Carousel
        setApi={setApi}
        opts={{ align: "start", containScroll: "trimSnaps", inViewThreshold: 0.9 }}
        aria-label="Your numbers"
        tabIndex={0}
        className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-iris"
      >
        <CarouselContent className="-ml-3">
          {cards.map((item, i) => (
            <CarouselItem
              key={item.key}
              aria-label={`${i + 1} of ${cards.length}: ${item.title}`}
              className={`flex pl-3 ${slideBasis}`}
            >
              <div data-you-frame className="flex w-full">
                <div
                  data-you-card
                  className={`${card} w-full origin-center will-change-transform ${item.className ?? ""}`}
                >
                  {item.body}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="hidden size-11 rounded-full pointer-fine:inline-flex"
          onClick={() => api?.scrollPrev()}
          disabled={selected === 0}
          aria-label="Previous card"
        >
          <ArrowLeft />
        </Button>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: snapCount }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === selected ? "w-5 bg-iris" : "w-1.5 bg-hair"
              }`}
            />
          ))}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="hidden size-11 rounded-full pointer-fine:inline-flex"
          onClick={() => api?.scrollNext()}
          disabled={selected >= snapCount - 1}
          aria-label="Next card"
        >
          <ArrowRight />
        </Button>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/**
 * The top of Group Dynamics: the signed-in member's own numbers for the
 * chosen period. Iris marks the viewer, as everywhere in the app.
 */
export default function YouSection({ groupId }: { groupId: string }) {
  const [range, setRange] = useState<ViewerSummaryRange>("30d");
  const { data, isLoading, error, refetch } = useViewerSummary(groupId, range);

  return (
    <section className="flex flex-col gap-3 md:gap-4" aria-labelledby="you-heading" data-tour="analytics-you">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
        <h2 id="you-heading" className={eyebrow}>You</h2>
        <ToggleGroup
          type="single"
          value={range}
          // Radix sends "" when the selected chip is pressed again; keep it selected.
          onValueChange={(next) => next && setRange(next as ViewerSummaryRange)}
          role="radiogroup"
          aria-label="Period for your numbers"
          className="gap-1.5"
        >
          {RANGES.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              className="min-h-11 min-w-11 flex-none rounded-xl first:rounded-xl last:rounded-xl border border-line px-3 font-mono text-xs text-foreground hover:bg-raised hover:text-foreground data-[state=on]:border-iris data-[state=on]:bg-selected data-[state=on]:text-foreground"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {error ? (
        <div className={`${card} items-start`} role="alert">
          <p className="text-sm text-foreground">Your numbers didn't load.</p>
          <Button variant="outline" className="min-h-11" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading && !data ? (
        <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Loading your numbers">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className={`h-40 shrink-0 rounded-2xl ${slideBasis}`} />
          ))}
        </div>
      ) : data ? (
        <YouCarousel data={data} range={data.range} />
      ) : null}
    </section>
  );
}
