import { Card, CardContent } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import { SidebarTrigger } from "../../ui/sidebar";
import { Button } from "../../ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import { useGroupAnalytics } from "../../../hooks/useGroupAnalytics";
import ActivityWave from "./ActivityWave";
import VibeRadar from "./VibeRadar";
import SuperlativeCard from "./SuperlativeCard";
import { Sparkles, Activity, ArrowLeft } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useGroups } from "../../../hooks/useGroups";
import { useMemo } from "react";

export default function AnalyticsScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { groups } = useGroups();
  
  // Find the group from the groups list
  const group = useMemo(() => groups.find(g => g._id === groupId) || null, [groups, groupId]);
  
  const { data, isLoading, isActivityLoading, isVibesLoading, error, activityRange, activityMode, vibesRange, changeTimeRange, changeActivityMode, changeVibesRange } = useGroupAnalytics(groupId || '');

  // Helper to safely access data
  const activityData = data?.activity || [];
  const vibeData = data?.vibes || [];
  const superlatives = data?.superlatives || {};

  // Time range options
  const timeRanges = [
    { value: '24h' as const, label: '24h' },
    { value: '7d' as const, label: '7d' },
    { value: '30d' as const, label: '30d' },
    { value: '90d' as const, label: '90d' },
    { value: 'all' as const, label: 'All' },
  ];


  // Show helpful message if no group is selected
  if (!groupId) {
    return (
      <>
        {/* Ambient Background Gradient */}
        <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-0" />

        {/* Header */}
        <header className="sticky top-0 z-10 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 md:h-16 items-center gap-2 md:gap-4 px-4 md:px-6">
            <SidebarTrigger />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover:bg-primary/10 shrink-0 min-w-[44px] min-h-[44px]"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-lg font-semibold tracking-tight">Group Dynamics</h1>
            </div>
          </div>
        </header>

        {/* No Group Selected Message */}
        <main className="p-4 md:p-8 relative z-0">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-block p-4 rounded-full bg-primary/10">
                <Activity className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">No Group Selected</h2>
              <p className="text-muted-foreground">
                Please select a group from your dashboard to view analytics
              </p>
              <Button
                onClick={() => navigate("/")}
                className="bg-primary hover:bg-primary/90 text-black"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      {/* Ambient Background Gradient */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-0" />

      {/* Header */}
      <header className="sticky top-0 z-10 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 md:h-16 items-center gap-2 md:gap-4 px-4 md:px-6">
          <SidebarTrigger />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-primary/10 shrink-0 min-w-[44px] min-h-[44px]"
                  onClick={() => navigate(`/groups/${groupId}`)}
                  aria-label="Back to group feed"
                >
                  <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Back to group feed</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-semibold tracking-tight">Group Dynamics</h1>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">
              Visualizing {group?.name || 'group'} activity and engagement
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-8 relative z-0 space-y-6 md:space-y-8 max-w-7xl mx-auto">
        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4 md:p-6">
              <p className="text-sm md:text-base text-destructive font-medium">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Top Section: Visualization & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 h-auto lg:h-[500px]">

          {/* 1. Vibe Radar (Personality) */}
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-base md:text-xl font-bold flex items-center gap-2">
                <span className="text-xl md:text-2xl">📡</span>
                Vibe Radar
              </h2>
              <span className="text-xs text-muted-foreground hidden sm:inline">Compare member personalities</span>
            </div>
            <Card className="flex-1 bg-black/40 border-white/5 overflow-hidden relative group">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
              <CardContent className="h-full flex items-center justify-center p-0">
                <VibeRadar 
                  data={vibeData} 
                  isLoading={isLoading} 
                  isVibesLoading={isVibesLoading}
                  vibesRange={vibesRange}
                  changeVibesRange={changeVibesRange}
                />
              </CardContent>
            </Card>
          </div>

          {/* 2. Waveform (Activity) */}
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-base md:text-xl font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                Resonance Frequency
              </h2>
            </div>
            
            {/* Time Range Selector and Mode Toggle */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 px-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                <div className="flex gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                  {timeRanges.map((range) => (
                    <Button
                      key={range.value}
                      size="sm"
                      variant={activityRange === range.value ? 'default' : 'outline'}
                      onClick={() => changeTimeRange(range.value)}
                      className={
                        activityRange === range.value
                          ? 'bg-primary hover:bg-primary/90 text-black h-8 sm:h-7 px-3 text-xs min-h-[44px] sm:min-h-0 shrink-0'
                          : 'border-primary/30 hover:bg-primary/10 h-8 sm:h-7 px-3 text-xs min-h-[44px] sm:min-h-0 shrink-0'
                      }
                    >
                      {range.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Mode Toggle */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-muted-foreground">View:</span>
                <div className="flex gap-1 border border-white/10 rounded-md p-0.5 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => changeActivityMode('shares')}
                    disabled={isActivityLoading}
                    className={
                      activityMode === 'shares'
                        ? 'bg-primary hover:bg-primary/90 text-black h-8 sm:h-7 px-3 text-xs min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial'
                        : 'hover:bg-white/5 h-8 sm:h-7 px-3 text-xs text-muted-foreground min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial'
                    }
                  >
                    Shares Posted
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => changeActivityMode('engagement')}
                    disabled={isActivityLoading}
                    className={
                      activityMode === 'engagement'
                        ? 'bg-primary hover:bg-primary/90 text-black h-8 sm:h-7 px-3 text-xs min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial'
                        : 'hover:bg-white/5 h-8 sm:h-7 px-3 text-xs text-muted-foreground min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial'
                    }
                  >
                    Engagement
                  </Button>
                </div>
              </div>
            </div>
            <Card className="flex-1 bg-black/20 border-white/5 overflow-hidden flex flex-col relative">
              {isActivityLoading && !isLoading && (
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] z-20 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
              <CardContent className="flex-1 p-0 flex items-stretch w-full">
                <ActivityWave data={activityData} isLoading={false} />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Section: Hall of Fame */}
        <div className="space-y-4 md:space-y-6 pt-4 md:pt-6 border-t border-border/50">
          <div className="flex items-center gap-2 px-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold">Hall of Fame</h2>
              <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Top performers and outliers in the group</p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 md:h-40 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {superlatives.trendsetter && (
                <SuperlativeCard
                  title="Trendsetter"
                  description="Most likes received across all shares"
                  icon="✨"
                  user={superlatives.trendsetter.user}
                  value={superlatives.trendsetter.value}
                  label="Influencer"
                  gradient="from-purple-500/20 to-pink-500/10"
                  delay={0.1}
                />
              )}
              {superlatives.hypeMan && (
                <SuperlativeCard
                  title="Hype Man"
                  description="Most likes given to others"
                  icon="❤️"
                  user={superlatives.hypeMan.user}
                  value={superlatives.hypeMan.value}
                  label="Supporter"
                  gradient="from-red-500/20 to-orange-500/10"
                  delay={0.2}
                />
              )}
              {superlatives.dj && (
                <SuperlativeCard
                  title="The DJ"
                  description="Most active sharer in the group"
                  icon="🎧"
                  user={superlatives.dj.user}
                  value={superlatives.dj.value}
                  label="Selector"
                  gradient="from-blue-500/20 to-cyan-500/10"
                  delay={0.3}
                />
              )}
              {superlatives.diehard && (
                <SuperlativeCard
                  title="Diehard"
                  description="Most tracks listened to"
                  icon="👂"
                  user={superlatives.diehard.user}
                  value={superlatives.diehard.value}
                  label="Listener"
                  gradient="from-emerald-500/20 to-green-500/10"
                  delay={0.4}
                />
              )}

              {/* Empty state if no superlatives found */}
              {Object.keys(superlatives).length === 0 && (
                <Card className="col-span-full border-dashed bg-transparent">
                  <CardContent className="h-24 md:h-32 flex items-center justify-center text-sm md:text-base text-muted-foreground px-4">
                    No data available for superlatives yet.
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

      </main>
    </>
  );
}
