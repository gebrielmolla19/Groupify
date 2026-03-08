import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import {
  Music2,
  Users,
  Share2,
  ListMusic,
  Trophy,
  ChevronRight,
  ChevronLeft,
  X,
} from 'lucide-react';

const TOUR_STORAGE_KEY = 'groupify_tour_completed';

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  hint: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: <Music2 className="w-12 h-12 text-primary" />,
    title: 'Welcome to Groupify',
    description:
      'Groupify is your social music hub — share tracks from Spotify with friends, discover new music together, and see who listens first.',
    hint: 'This quick tour covers the key features. It takes about a minute.',
  },
  {
    icon: <Users className="w-12 h-12 text-primary" />,
    title: 'Create or Join a Group',
    description:
      'Groups are shared spaces where you and your friends exchange music. Create a new group and invite friends, or enter an invite code to join one.',
    hint: 'Each group has a unique invite code — copy it from the dashboard and share it with friends.',
  },
  {
    icon: <Share2 className="w-12 h-12 text-primary" />,
    title: 'Share Songs from Spotify',
    description:
      'Inside a group, search for any track on Spotify and share it with the group. Your shared songs appear in the group feed instantly.',
    hint: 'Use the search bar at the top of a group feed to find and share tracks.',
  },
  {
    icon: <ListMusic className="w-12 h-12 text-primary" />,
    title: 'Browse the Group Feed',
    description:
      "The feed shows every song your group has shared. Tap \"Mark as Listened\" to log that you've heard a track — and see who else has too.",
    hint: 'Listener avatars appear below each track. The faster you listen, the better your stats.',
  },
  {
    icon: <Trophy className="w-12 h-12 text-primary" />,
    title: 'Compete on the Leaderboard',
    description:
      'Analytics tracks who shares the most, who discovers new genres first, and who listens the fastest. Check Group Dynamics to see where you rank.',
    hint: 'You can view analytics per group — each group has its own leaderboard and stats.',
  },
];

export default function OnboardingWalkthrough() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const markCompleted = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      markCompleted();
      setOpen(false);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSkip = () => {
    markCompleted();
    setOpen(false);
  };

  const currentStep = STEPS[step];
  const progressPercent = ((step + 1) / STEPS.length) * 100;
  const isLastStep = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleSkip(); }}>
      <DialogContent
        className="max-w-md w-full p-0 overflow-hidden gap-0"
        aria-label="Onboarding walkthrough"
      >
        <Progress
          value={progressPercent}
          className="rounded-none h-1 [&>div]:bg-primary [&>div]:transition-all [&>div]:duration-300"
        />

        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <span className="text-xs text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            aria-label="Skip tour"
          >
            <X className="w-3 h-3" />
            Skip
          </button>
        </div>

        <DialogHeader className="px-6 pb-2 space-y-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex flex-col items-center text-center gap-4 py-4"
            >
              <div className="flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 border border-primary/20">
                {currentStep.icon}
              </div>

              <DialogTitle className="text-xl">
                {currentStep.title}
              </DialogTitle>

              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                {currentStep.description}
              </DialogDescription>

              <div className="w-full bg-muted/40 border border-border rounded-lg px-4 py-3 text-left">
                <p className="text-xs text-muted-foreground">
                  <span className="text-primary font-medium">Tip: </span>
                  {currentStep.hint}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </DialogHeader>

        <div className="flex items-center justify-between px-6 pb-6 pt-2 gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={step === 0}
            className="min-w-[80px]"
            aria-label="Previous step"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <Button
            size="sm"
            onClick={handleNext}
            className="min-w-[80px] bg-primary text-black hover:bg-primary/90"
            aria-label={isLastStep ? 'Finish tour' : 'Next step'}
          >
            {isLastStep ? (
              'Get Started'
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function resetTour(): void {
  localStorage.removeItem(TOUR_STORAGE_KEY);
}
