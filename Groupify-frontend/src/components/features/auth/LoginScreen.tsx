import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Music } from "lucide-react";
import { Button } from "../../ui/button";
import { login } from "../../../lib/api";
import { toast } from "sonner";
import { logger } from "../../../utils/logger";

// Seven rings, one 35s cycle, staggered evenly so the page loads mid-cycle
// with every ring visible. The third ring uses the text colour (#57).
const RING_COUNT = 7;
const RING_SECONDS = 35;
const RINGS = Array.from({ length: RING_COUNT }, (_, i) => ({
  delay: `${(-i * RING_SECONDS) / RING_COUNT}s`,
  tone: i === 2 ? "text" : "iris",
}));

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  // Multi-app workaround: ?app=1 or ?app=2 for users 6-10, 11-15
  const appParam = searchParams.get("app");
  const appIndex = appParam ? parseInt(appParam, 10) : undefined;

  const handleLogin = async () => {
    try {
      logger.info('Login initiated', appIndex != null ? { appIndex } : {});
      setIsLoading(true);
      login(appIndex);
      // Login redirects, so no need to handle success here
    } catch (error) {
      logger.error('Login failed:', error);
      toast.error('Failed to connect to Spotify. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-background p-2 text-foreground">
      <main className="login-pane relative flex min-w-0 flex-1 flex-col justify-center gap-7 overflow-hidden rounded-2xl bg-pane px-[clamp(24px,6vw,96px)] py-12">
        <div aria-hidden="true" data-testid="login-rings" className="pointer-events-none absolute inset-0">
          {RINGS.map((ring) => (
            <span
              key={ring.delay}
              className="login-ring"
              data-tone={ring.tone}
              style={{ animationDelay: ring.delay }}
            />
          ))}
        </div>

        <div className="relative flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground"
          >
            <Music className="size-5" strokeWidth={2.5} />
          </span>
          <span className="font-display text-[22px] font-extrabold tracking-tight">Groupify</span>
        </div>

        <div className="relative flex max-w-[480px] flex-col gap-3.5">
          <h1 className="text-[clamp(40px,5vw,64px)] leading-none tracking-[-0.03em]">
            Send songs to the people who get it.
          </h1>
          <p className="text-[17px] leading-relaxed text-soft">
            Share tracks with a small group, see who actually listened, and find out whose taste
            matches yours.
          </p>
        </div>

        <div className="relative flex flex-col items-start gap-3">
          <Button
            className="h-13 px-6 text-base"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? "Connecting to Spotify…" : "Continue with Spotify"}
          </Button>
          <p className="max-w-[400px] text-[13px] leading-normal text-quiet">
            Playback needs Spotify Premium. Groupify reads your profile and controls playback; it
            never posts for you.
          </p>
        </div>
      </main>
    </div>
  );
}
