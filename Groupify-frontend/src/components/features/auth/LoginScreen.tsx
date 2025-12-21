import { useMemo, useState } from "react";
import { Button } from "../../ui/button";
import { Music, Waves } from "lucide-react";
import { login } from "../../../lib/api";
import { toast } from "sonner";
import { logger } from "../../../utils/logger";

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      logger.info('Login initiated');
      setIsLoading(true);
      await login();
      // Login redirects, so no need to handle success here
    } catch (error) {
      logger.error('Login failed:', error);
      toast.error('Failed to connect to Spotify. Please try again.');
      setIsLoading(false);
    }
  };

  // Generate audio visualizer bar data to fill the entire width
  // Create fewer, thicker bars with varying heights and delays
  const barData = useMemo(() => {
    const bars = [];
    const heights = [0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0];
    // Generate fewer bars - enough to fill width but with thicker bars
    const barCount = typeof window !== 'undefined' 
      ? Math.max(40, Math.floor(window.innerWidth / 20)) 
      : 40;
    for (let i = 0; i < barCount; i++) {
      bars.push({
        height: heights[Math.floor(Math.random() * heights.length)],
        delay: Math.random() * 0.5,
      });
    }
    return bars;
  }, []);

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-black via-zinc-950 to-black flex items-center justify-center" style={{ overflow: 'hidden' }}>
      {/* Audio Visualizer Background */}
      <div className="absolute inset-0 audio-visualizer-container" style={{ opacity: 0.25 }} aria-hidden="true">
        <div className="absolute bottom-0 left-0 right-0 top-0 flex items-end gap-[3px] w-full" style={{ width: '100%', paddingLeft: 0, paddingRight: 0 }}>
          {barData.map((bar, index) => {
            // Calculate height as percentage of viewport height
            const barHeight = Math.max(bar.height * 100, 10); // 10% to 100% of container height
            return (
              <div
                key={index}
                className={`audio-bar audio-bar-${(index % 4) + 1}`}
                style={{
                  flex: '1 1 0',
                  minWidth: '8px',
                  width: 'auto',
                  height: `${barHeight}%`,
                  minHeight: '10%',
                  background: 'linear-gradient(to top, rgba(0, 255, 136, 0.8), rgba(0, 255, 136, 0.3), rgba(0, 255, 136, 0.05))',
                  borderRadius: '4px 4px 0 0',
                  animationDelay: `${bar.delay}s`,
                } as React.CSSProperties}
              />
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 max-w-xl mx-auto px-6 text-center">
        {/* Logo/Icon */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" aria-hidden="true" />
            <div className="relative bg-zinc-900 border border-primary/30 p-6 rounded-2xl">
              <Music className="w-16 h-16 text-primary" strokeWidth={1.5} aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Heading */}
        <h1 className="mb-4 text-5xl bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
          Groupify
        </h1>

        {/* Tagline */}
        <p className="mb-12 text-xl text-zinc-400 max-w-md mx-auto">
          Share music, compete with friends, and discover what makes your group
          unique
        </p>

        {/* CTA Button */}
        <Button
          size="lg"
          className="bg-primary hover:bg-primary/90 text-black px-8 py-6 h-auto group relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,136,0.3)]"
          onClick={handleLogin}
          disabled={isLoading}
          aria-label="Login with Spotify"
        >
          <span className="relative z-10 flex items-center gap-3">
            {isLoading ? (
              <>
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Connecting to Spotify...
              </>
            ) : (
              <>
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Login with Spotify
              </>
            )}
          </span>
        </Button>

        {/* Features list */}
        <div className="mt-16 grid grid-cols-3 gap-6 text-sm text-zinc-500">
          <div className="space-y-2">
            <Waves className="w-5 h-5 text-primary mx-auto" aria-hidden="true" />
            <p>Real-time sharing</p>
          </div>
          <div className="space-y-2">
            <Music className="w-5 h-5 text-primary mx-auto" aria-hidden="true" />
            <p>Group playlists</p>
          </div>
          <div className="space-y-2">
            <svg
              className="w-5 h-5 text-primary mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p>Analytics & leaderboards</p>
          </div>
        </div>
      </main>
    </div>
  );
}
