import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '../../ui/button';
import { useGroups } from '../../../hooks/useGroups';
import { useIsMobile } from '../../ui/use-mobile';
import { DESKTOP_PLAYER_HEIGHT, PHONE_PLAYER_TOP, STACK_GAP } from '../../../lib/layout';
import { placeTourCard, type Box } from '../../../lib/tourPlacement';

const TOUR_STORAGE_KEY = 'groupify_tour_completed';
/** Space between a target and the spotlight drawn around it. */
const SPOTLIGHT_PAD = 6;
/** Above everything on the page, including the player (zIndex 9999). */
const TOUR_Z_INDEX = 10000;

interface TourStep {
  title: string;
  text: string;
  /**
   * Selectors for the element to spotlight, in order of preference. The
   * first one with a visible match wins; with none, the card shows alone.
   */
  targets: string[];
}

// The four-step walkthrough of the group feed (#57, "Tour" in the mock).
export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Share a song here',
    text: 'Search Spotify and send a track to everyone in the group.',
    targets: ['[data-tour="share-input"]'],
  },
  {
    title: 'A dot means unheard',
    text: 'Songs you have not played yet are bold with a dot, like unread messages.',
    targets: ['[data-tour="share-row"][data-unheard]', '[data-tour="share-row"]'],
  },
  {
    title: 'See who has listened',
    text: 'This shows how many members have played the song. Playing it counts as a listen; there is nothing to tap.',
    targets: ['[data-tour="listeners"]'],
  },
  {
    title: 'Everything about one song',
    text: 'Tap a song to play it, like it, and see who heard it and how soon.',
    targets: ['[data-tour="song-detail"]', '[data-tour="share-row"]'],
  },
];

const GROUP_FEED_PATH = /^\/groups\/[^/]+\/?$/;

function findTarget(selectors: string[]): Element | null {
  for (const selector of selectors) {
    for (const el of document.querySelectorAll(selector)) {
      // Skips copies hidden at this width (the row has one heard count per layout).
      if (el.getClientRects().length > 0) return el;
    }
  }
  return null;
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

/**
 * The first-run walkthrough: four steps over the group feed, each
 * spotlighting one part of it with a card beside it. Opens by itself once
 * the user is in a group, and again from "Take the tour" (startTour).
 */
export default function OnboardingWalkthrough() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<Box | null>(null);
  const [cardSize, setCardSize] = useState({ width: 320, height: 220 });
  const cardRef = useRef<HTMLDivElement>(null);
  const autoOpened = useRef(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { groups, isLoading } = useGroups();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const textId = useId();

  const firstGroupId = groups?.[0]?._id;
  const current = TOUR_STEPS[step];
  const isLastStep = step === TOUR_STEPS.length - 1;

  // First run: open once the user has a group, since every step is on its feed.
  useEffect(() => {
    if (autoOpened.current || isLoading || !firstGroupId) return;
    if (localStorage.getItem(TOUR_STORAGE_KEY)) return;
    autoOpened.current = true;
    const timer = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(timer);
  }, [isLoading, firstGroupId]);

  // On demand from anywhere (startTour).
  useEffect(() => {
    const handler = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener('groupify:start-tour', handler);
    return () => window.removeEventListener('groupify:start-tour', handler);
  }, []);

  // Show a group feed: stay on the one that's open, else go to the first group.
  useEffect(() => {
    if (open && firstGroupId && !GROUP_FEED_PATH.test(pathname)) navigate(`/groups/${firstGroupId}`);
    // Only when the tour opens: later navigation by the user is theirs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, firstGroupId]);

  // Follow the target and the card's size. The feed loads and reflows after
  // the tour opens, so poll as well as listening for scroll and resize.
  useEffect(() => {
    if (!open) return;
    let scrolled = false;
    const update = () => {
      const el = findTarget(current.targets);
      if (el && !scrolled) {
        scrolled = true;
        el.scrollIntoView({ block: 'nearest' });
      }
      const r = el?.getBoundingClientRect();
      const next = r
        ? { left: r.left - SPOTLIGHT_PAD, top: r.top - SPOTLIGHT_PAD, width: r.width + 2 * SPOTLIGHT_PAD, height: r.height + 2 * SPOTLIGHT_PAD }
        : null;
      setTarget((prev) => (sameBox(prev, next) ? prev : next));
      const card = cardRef.current;
      if (card && card.offsetHeight > 0) {
        const size = { width: card.offsetWidth, height: card.offsetHeight };
        setCardSize((prev) => (prev.width === size.width && prev.height === size.height ? prev : size));
      }
    };
    update();
    const timer = setInterval(update, 200);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, current]);

  // Focus the card when the tour opens, so keyboard users start in it.
  useEffect(() => {
    if (open) cardRef.current?.focus({ preventScroll: true });
  }, [open]);

  const close = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  const bottomInset = isMobile ? PHONE_PLAYER_TOP + STACK_GAP : DESKTOP_PLAYER_HEIGHT + 2 * STACK_GAP;
  const position = placeTourCard({
    target,
    card: cardSize,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    bottomInset,
  });

  return createPortal(
    <>
      {/* The spotlight: an iris outline whose shadow dims the rest of the page,
          like a dialog's overlay. Clicks pass through to the page. */}
      {target && (
        <div
          aria-hidden="true"
          data-testid="tour-spotlight"
          className="pointer-events-none fixed rounded-[14px] border-2 border-iris shadow-[0_0_0_9999px_color-mix(in_oklab,var(--ground)_70%,transparent)] transition-[left,top,width,height] duration-300 ease-out motion-reduce:transition-none"
          style={{ left: target.left, top: target.top, width: target.width, height: target.height, zIndex: TOUR_Z_INDEX }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={textId}
        tabIndex={-1}
        className="fixed w-[min(320px,calc(100vw-32px))] outline-none"
        style={{ left: position.left, top: position.top, zIndex: TOUR_Z_INDEX }}
      >
        {/* Announces each step; the card below remounts per step to fade in. */}
        <p aria-live="polite" className="sr-only">
          Step {step + 1} of {TOUR_STEPS.length}: {current.title}
        </p>
        <motion.div
          key={step}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="flex flex-col gap-2.5 rounded-2xl border border-hair bg-raised p-5 text-foreground shadow-xl"
        >
          <span className="font-mono text-xs text-iris">
            {step + 1} of {TOUR_STEPS.length}
          </span>
          <h2 id={titleId} className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em]">
            {current.title}
          </h2>
          <p id={textId} className="text-sm leading-normal text-soft">
            {current.text}
          </p>
          <div className="flex items-center justify-between gap-2 pt-1.5">
            <Button variant="ghost" className="-ml-3 text-soft" onClick={close}>
              Skip tour
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              <Button onClick={isLastStep ? close : () => setStep((s) => s + 1)}>
                {isLastStep ? 'Done' : 'Next'}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </>,
    document.body
  );
}

export function startTour(): void {
  localStorage.removeItem(TOUR_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('groupify:start-tour'));
}
