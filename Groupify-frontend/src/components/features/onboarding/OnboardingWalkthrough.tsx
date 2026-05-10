import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import {
  Music2,
  Users,
  Share2,
  ListMusic,
  Trophy,
  Activity,
  BarChart2,
  Star,
  ChevronRight,
  ChevronLeft,
  X,
  Heart,
  ListOrdered,
  Search,
  User,
} from 'lucide-react';
import { useGroups } from '../../../hooks/useGroups';

const TOUR_STORAGE_KEY = 'groupify_tour_completed';

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  hint: string;
  route: (groupId?: string) => string;
  /** CSS selector(s) for elements to highlight. Comma-separated for multiple. */
  highlight?: string;
  /** CSS selector to scroll into view after navigating */
  scrollTo?: string;
}

const STEPS: OnboardingStep[] = [
  // ── Step 1: Welcome ────────────────────────────────────────────────────────
  {
    icon: <Music2 style={{ width: 32, height: 32, color: 'var(--primary)' }} />,
    title: 'Welcome to Groupify',
    description:
      'Groupify is your social music hub — share tracks from Spotify with friends, discover new music together, and see who listens first.',
    hint: 'This quick tour covers the key features. It takes about a minute.',
    route: () => '/',
  },

  // ── Step 2: Create / Join ───────────────────────────────────────────────────
  {
    icon: <Users style={{ width: 32, height: 32, color: 'var(--primary)' }} />,
    title: 'Create or Join a Group',
    description:
      'Groups are shared spaces where you and your friends exchange music. Create a new group and invite friends, or enter an invite code to join one.',
    hint: 'Each group has a unique invite code — copy it from the dashboard and share it with friends.',
    route: () => '/',
    highlight: '[data-tour="create-group"],[data-tour="join-group"]',
  },

  // ── Step 3: Share Songs ─────────────────────────────────────────────────────
  {
    icon: <Share2 style={{ width: 32, height: 32, color: 'var(--primary)' }} />,
    title: 'Share Songs from Spotify',
    description:
      'Inside a group, use the search bar to find any track on Spotify and share it instantly. Everyone in the group sees it appear in the feed right away.',
    hint: 'Type a song name or artist — results show in real time as you type.',
    route: (groupId) => (groupId ? `/groups/${groupId}` : '/'),
    highlight: '[data-tour="share-input"]',
  },

  // ── Step 4: Mark as Listened ────────────────────────────────────────────────
  {
    icon: <ListMusic style={{ width: 32, height: 32, color: 'var(--primary)' }} />,
    title: 'Songs Get Marked as Listened',
    description:
      "Listening is tracked automatically — just play a track and it's logged. Small avatar circles appear below each song card showing everyone who has listened.",
    hint: 'The faster you listen, the better your Listener Reflex score in analytics!',
    route: (groupId) => (groupId ? `/groups/${groupId}` : '/'),
    highlight: '[data-tour="mark-listened"]',
  },

  // ── Step 5: Like ────────────────────────────────────────────────────────────
  {
    icon: <Heart style={{ width: 32, height: 32, color: 'var(--primary)' }} />,
    title: 'Like Tracks',
    description:
      'Give a like to tracks you love. Likes show appreciation for the sharer and count toward the "Hype Man" award — given to whoever supports the group most.',
    hint: 'Liking a track also helps surface great music for the whole group.',
    route: (groupId) => (groupId ? `/groups/${groupId}` : '/'),
    highlight: '[data-tour="like-btn"]',
  },

  // ── Step 6: Group Toolbar ───────────────────────────────────────────────────
  {
    icon: <ListOrdered style={{ width: 32, height: 32, color: 'var(--primary)' }} />,
    title: 'Group Toolbar',
    description:
      'At the top of each group feed you\'ll find quick-access buttons: "Playlist" to open the group\'s Spotify playlist, "Invite" to share the group code, "Analytics" for stats, and "Settings" to manage the group.',
    hint: 'The Playlist button opens the group\'s auto-generated Spotify playlist directly.',
    route: (groupId) => (groupId ? `/groups/${groupId}` : '/'),
    highlight:
      '[data-tour="playlist-btn"],[data-tour="invite-btn"],[data-tour="analytics-btn"],[data-tour="settings-btn"]',
  },

  // ── Step 7: Resonance Frequency ─────────────────────────────────────────────
  {
    icon: <Activity style={{ width: 32, height: 32, color: 'var(--primary)' }} />,
    title: 'Resonance Frequency',
    description:
      'The Group Dynamics page opens with Resonance Frequency — a wave chart showing sharing and engagement activity over time. Switch between "Shares Posted" and "Engagement" views.',
    hint: 'Use the time-range buttons (24h, 7d, 30d…) to zoom in or out on activity.',
    route: (groupId) => (groupId ? `/groups/${groupId}/analytics` : '/'),
    highlight: '[data-tour="analytics-resonance"]',
    scrollTo: '[data-tour="analytics-resonance"]',
  },

  // ── Step 8: Listener Reflex ──────────────────────────────────────────────────
  {
    icon: <BarChart2 style={{ width: 32, height: 32, color: 'var(--primary)' }} />,
    title: 'Listener Reflex',
    description:
      'Listener Reflex ranks members by how quickly they listen to shared songs. A low average response time means you\'re first to the music — a true early adopter.',
    hint: 'Response time is measured from when a song is shared to when you mark it listened.',
    route: (groupId) => (groupId ? `/groups/${groupId}/analytics` : '/'),
    highlight: '[data-tour="analytics-reflex"]',
    scrollTo: '[data-tour="analytics-reflex"]',
  },

  // ── Step 9: Taste Gravity ────────────────────────────────────────────────────
  {
    icon: <Star style={{ width: 32, height: 32, color: 'var(--primary)' }} />,
    title: 'Taste Gravity',
    description:
      'Taste Gravity visualises musical connections between group members. Members who share similar genres or artists are drawn closer together in the graph.',
    hint: 'Zoom and drag the graph to explore connections between members.',
    route: (groupId) => (groupId ? `/groups/${groupId}/analytics` : '/'),
    highlight: '[data-tour="analytics-taste"]',
    scrollTo: '[data-tour="analytics-taste"]',
  },

  // ── Step 10: Hall of Fame ────────────────────────────────────────────────────
  {
    icon: <Trophy style={{ width: 32, height: 32, color: 'var(--primary)' }} />,
    title: 'Hall of Fame',
    description:
      'Hall of Fame awards four titles: Trendsetter (most likes received), Hype Man (most likes given), The DJ (most shares), and Diehard (most tracks listened). Compete for them all!',
    hint: 'Awards reset per time range — check "All time" for the overall champion.',
    route: (groupId) => (groupId ? `/groups/${groupId}/analytics` : '/'),
    highlight: '[data-tour="analytics-halloffame"]',
    scrollTo: '[data-tour="analytics-halloffame"]',
  },
];

// ── Mock preview components ────────────────────────────────────────────────────

function MockShareInput() {
  return (
    <div className="rounded-lg border border-white/10 bg-card/50 p-3 mb-3 space-y-2">
      <div className="flex items-center gap-2 rounded-md border border-white/15 bg-background px-3 py-2">
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground">Search for a song or artist…</span>
      </div>
      <div className="flex items-center gap-2 p-2 rounded-md bg-white/5 border border-white/5">
        <div className="w-8 h-8 rounded bg-primary/20 flex-shrink-0 flex items-center justify-center">
          <Music2 className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">Blinding Lights</p>
          <p className="text-[10px] text-muted-foreground">The Weeknd</p>
        </div>
        <div className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 flex-shrink-0 font-medium">
          Share
        </div>
      </div>
    </div>
  );
}

// Fake listeners for the listened mock — on-theme with app palette
const MOCK_LISTENERS = [
  { bg: 'rgba(0,255,136,0.2)', color: 'var(--primary)' },
  { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' },
];

function MockSongCardListened() {
  return (
    <div className="rounded-lg border border-white/10 bg-card/50 overflow-hidden mb-3">
      {/* Song row */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-2.5">
        <div className="w-9 h-9 rounded bg-primary/15 flex-shrink-0 flex items-center justify-center">
          <Music2 className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">Blinding Lights</p>
          <p className="text-[10px] text-muted-foreground">The Weeknd · Shared by Alex</p>
        </div>
      </div>
      {/* Listeners row */}
      <div className="border-t border-white/5 px-3 py-2 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">Listened by</span>
        <div className="flex items-center gap-1.5">
          {MOCK_LISTENERS.map((l, i) => (
            <div
              key={i}
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: l.bg, color: l.color }}
            >
              <User className="w-3 h-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockSongCardLike() {
  return (
    <div className="rounded-lg border border-white/10 bg-card/50 p-3 mb-3">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded bg-primary/20 flex-shrink-0 flex items-center justify-center">
          <Music2 className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">Blinding Lights</p>
          <p className="text-[10px] text-muted-foreground">The Weeknd · Shared by Alex</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/5">
            <img src="/like-icon-svg/like-icon-like.svg" alt="Like" className="w-4 h-4" />
          </div>
          <span className="text-xs text-muted-foreground">4</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

export default function OnboardingWalkthrough() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [highlightMissing, setHighlightMissing] = useState(false);
  const navigate = useNavigate();
  const { groups } = useGroups();

  const firstGroupId = groups?.[0]?._id;

  // Show tour if not completed
  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  // Allow on-demand trigger from anywhere via custom event
  useEffect(() => {
    const handler = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener('groupify:start-tour', handler);
    return () => window.removeEventListener('groupify:start-tour', handler);
  }, []);

  // Navigate to the relevant page on step change
  useEffect(() => {
    if (!open) return;
    navigate(STEPS[step].route(firstGroupId));
  }, [step, open, firstGroupId, navigate]);

  // Apply / remove highlight on target elements; detect when targets are missing
  useEffect(() => {
    if (!open) return;
    const selector = STEPS[step].highlight;
    if (!selector) {
      setHighlightMissing(false);
      return;
    }

    const timer = setTimeout(() => {
      const elements = document.querySelectorAll(selector);
      setHighlightMissing(elements.length === 0);
      elements.forEach((el) => el.classList.add('tour-highlight'));
    }, 150);

    return () => {
      clearTimeout(timer);
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => el.classList.remove('tour-highlight'));
    };
  }, [step, open]);

  // Scroll analytics sections into view
  useEffect(() => {
    if (!open) return;
    const scrollTarget = STEPS[step].scrollTo;
    if (!scrollTarget) return;

    const timer = setTimeout(() => {
      const el = document.querySelector(scrollTarget);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 600);

    return () => clearTimeout(timer);
  }, [step, open]);

  // Clean up all highlights on close
  useEffect(() => {
    if (!open) {
      document.querySelectorAll('.tour-highlight').forEach((el) =>
        el.classList.remove('tour-highlight')
      );
    }
  }, [open]);

  const markCompleted = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  }, []);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      markCompleted();
      setOpen(false);
      navigate('/');
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSkip = useCallback(() => {
    markCompleted();
    setOpen(false);
  }, [markCompleted]);

  if (!open) return null;

  const currentStep = STEPS[step];
  const progressPercent = ((step + 1) / STEPS.length) * 100;
  const isLastStep = step === STEPS.length - 1;

  return createPortal(
    <>
      {/* Global highlight styles */}
      <style>{`
        .tour-highlight {
          box-shadow: 0 0 0 3px #00FF88, 0 0 0 10px rgba(0,255,136,0.25) !important;
          border-radius: 8px;
          position: relative;
          z-index: 51;
          animation: tour-pulse 1.6s ease-in-out infinite;
        }
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 3px #00FF88, 0 0 0 10px rgba(0,255,136,0.25); }
          50%       { box-shadow: 0 0 0 3px #00FF88, 0 0 0 18px rgba(0,255,136,0.08); }
        }
      `}</style>

      {/* Floating card — fixed at bottom center, no overlay.
          Sits above the Spotify player (which is at bottom 20-24px,
          ~80px tall, zIndex 9999). Bottom offset 140px clears the player
          on both mobile and desktop; zIndex 10000 wins the stacking
          contest if any horizontal overlap remains. */}
      <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom) + 140px)', left: '50%', transform: 'translateX(-50%) translateZ(0)', willChange: 'transform', zIndex: 10000, width: 'min(calc(100vw - 2rem), 384px)', pointerEvents: 'none' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ pointerEvents: 'auto' }}
            className="rounded-xl border border-white/10 bg-background/95 backdrop-blur-md shadow-2xl overflow-hidden"
          >
            {/* Progress bar */}
            <Progress
              value={progressPercent}
              className="rounded-none h-0.5 [&>div]:bg-primary [&>div]:transition-all [&>div]:duration-300"
            />

            <div className="p-4">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
                    {currentStep.icon}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Step {step + 1} of {STEPS.length}
                    </p>
                    <p className="text-sm font-semibold leading-tight">{currentStep.title}</p>
                  </div>
                </div>
                <button
                  onClick={handleSkip}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Skip tour"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                {currentStep.description}
              </p>

              {/* Mock previews when real UI elements are not available */}
              {highlightMissing && step === 2 && <MockShareInput />}
              {highlightMissing && step === 3 && <MockSongCardListened />}
              {highlightMissing && step === 4 && <MockSongCardLike />}

              {/* Tip */}
              <div className="bg-primary/5 border border-primary/15 rounded-md px-3 py-2 mb-3">
                <p className="text-xs text-muted-foreground">
                  <span className="text-primary font-medium">Tip: </span>
                  {currentStep.hint}
                </p>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  disabled={step === 0}
                  className="h-8 px-3 text-xs min-w-[64px]"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Back
                </Button>

                {/* Step dots */}
                <div className="flex gap-1">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        i === step ? 'bg-primary' : 'bg-white/20'
                      }`}
                    />
                  ))}
                </div>

                <Button
                  size="sm"
                  onClick={handleNext}
                  className="h-8 px-3 text-xs min-w-[64px] bg-primary text-black hover:bg-primary/90"
                >
                  {isLastStep ? (
                    'Get Started'
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>,
    document.body
  );
}

export function startTour(): void {
  localStorage.removeItem(TOUR_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('groupify:start-tour'));
}
