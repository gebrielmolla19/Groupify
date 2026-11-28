import { Card, CardContent } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import { Button } from "../../ui/button";
import { useGroupAnalytics } from "../../../hooks/useGroupAnalytics";
import ActivityWave from "./ActivityWave";
import SuperlativeCard from "./SuperlativeCard";
import ListenerReflexCard from "./ListenerReflexCard";
import TasteGravity from "./TasteGravity";
import YouSection from "./YouSection";
import AnalyticsRangeControl from "./AnalyticsRangeControl";
import { Activity, ArrowLeft, Zap, BarChart3 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { eyebrow } from "../profile/SettingsSection";
import { useUser } from "../../../contexts/UserContext";
import type { SuperlativeKind } from "../../../lib/groupChartsCopy";
import { useParams, useNavigate } from "react-router-dom";
import { useGroups } from "../../../hooks/useGroups";
import { useMemo, useState } from "react";
import { cn } from "../../../lib/utils";
import { useAnalyticsRange } from "../../../hooks/useAnalyticsRange";
import type { ListenerReflexMode } from "../../../hooks/useListenerReflex";

// The "You" section's card, for every group section on the page.
const card = "rounded-2xl border border-hair bg-raised p-4 md:p-5";

const HALL_OF_FAME: { kind: SuperlativeKind; title: string }[] = [
  { kind: "trendsetter", title: "Trendsetter" },
  { kind: "hypeMan", title: "Hype Man" },
  { kind: "dj", title: "The DJ" },
  { kind: "diehard", title: "Diehard" },
];

const MODES = [
  { value: "shares", label: "Shares" },
  { value: "engagement", label: "Engagement" },
] as const;

export default function AnalyticsScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { groups } = useGroups();
  const { user } = useUser();
  
  // Find the group from the groups list
  const group = useMemo(() => groups.find(g => g._id === groupId) || null, [groups, groupId]);
  
  // One period for the whole page. Every section takes it as a `range` prop.
  const [range, setRange] = useAnalyticsRange();
  const { activity: activityData, superlatives, isLoading, isActivityLoading, error, activityMode, changeActivityMode } = useGroupAnalytics(groupId || '', range);

  // Listener Reflex state
  const [reflexMode, setReflexMode] = useState<ListenerReflexMode>('received');
  const [reflexCompare, setReflexCompare] = useState(false);

  // Show helpful message if no group is selected
  if (!groupId) {
    return (
      <>
        {/* Ambient Background Gradient */}
        <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-0" />

        {/* Header */}
        <header className="sticky top-0 z-10 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 md:h-16 items-center gap-2 md:gap-4 px-4 md:px-6">
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
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-primary/10 shrink-0 min-w-[44px] min-h-[44px]"
            onClick={() => navigate(`/groups/${groupId}`)}
            aria-label="Back to group feed"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-semibold tracking-tight">Group Dynamics</h1>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">
              Visualizing {group?.name || 'group'} activity and engagement
            </p>
          </div>
          <AnalyticsRangeControl value={range} onChange={setRange} />
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

        <YouSection groupId={groupId} range={range} />

        {/* Resonance Frequency */}
        <section className="flex flex-col gap-3 md:gap-4" aria-labelledby="resonance-heading" data-tour="analytics-resonance">
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-2">
            <h2 id="resonance-heading" className={eyebrow}>Resonance frequency</h2>
            <ToggleGroup
              type="single"
              value={activityMode}
              // Radix sends "" when the selected chip is pressed again; keep it selected.
              onValueChange={(next) => next && changeActivityMode(next as typeof activityMode)}
              aria-label="Count shares or engagement"
              className="shrink-0 gap-1.5"
            >
              {MODES.map((mode) => (
                <ToggleGroupItem
                  key={mode.value}
                  value={mode.value}
                  disabled={isActivityLoading}
                  className="min-h-11 flex-none rounded-xl first:rounded-xl last:rounded-xl border border-line px-3 text-xs text-foreground hover:bg-raised hover:text-foreground data-[state=on]:border-iris data-[state=on]:bg-selected data-[state=on]:text-foreground"
                >
                  {mode.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className={`${card} relative`}>
            {isActivityLoading && !isLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-raised/70">
                <div className="size-8 animate-spin rounded-full border-2 border-hair border-t-foreground" aria-label="Loading" />
              </div>
            )}
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : (
              <ActivityWave data={activityData} mode={activityMode} range={range} />
            )}
          </div>
        </section>

        {/* Listener Reflex Section */}
        <div className="space-y-4 md:space-y-6 pt-4 md:pt-6 border-t border-border/50" data-tour="analytics-reflex">
          <div className="flex flex-col gap-4 px-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-base md:text-xl font-bold">Listener Reflex</h2>
                <span className="text-xs text-muted-foreground hidden sm:inline">How fast members react to shared songs</span>
              </div>
            </div>

            {/* Controls: Mode + Compare */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Mode Toggle + Compare */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">View:</span>
                <div className="flex gap-1 border border-hair rounded-md p-0.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setReflexMode('received')}
                    className={
                      reflexMode === 'received'
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground h-8 sm:h-7 px-3 text-xs min-h-[44px] min-w-11 sm:min-h-0 sm:min-w-0'
                        : 'hover:bg-selected h-8 sm:h-7 px-3 text-xs text-muted-foreground min-h-[44px] min-w-11 sm:min-h-0 sm:min-w-0'
                    }
                  >
                    Received
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setReflexMode('shared')}
                    className={
                      reflexMode === 'shared'
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground h-8 sm:h-7 px-3 text-xs min-h-[44px] min-w-11 sm:min-h-0 sm:min-w-0'
                        : 'hover:bg-selected h-8 sm:h-7 px-3 text-xs text-muted-foreground min-h-[44px] min-w-11 sm:min-h-0 sm:min-w-0'
                    }
                  >
                    Shared
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant={reflexCompare ? 'default' : 'outline'}
                  onClick={() => setReflexCompare(!reflexCompare)}
                  className={cn(
                    'h-8 sm:h-7 px-3 text-xs flex items-center gap-1.5 min-h-[44px] min-w-11 sm:min-h-0 sm:min-w-0 shrink-0',
                    reflexCompare
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      : 'border-primary/30 hover:bg-primary/10'
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Compare
                </Button>
              </div>
            </div>
          </div>
          <ListenerReflexCard
            groupId={groupId || ''}
            range={range}
            mode={reflexMode}
            isCompareMode={reflexCompare}
          />
        </div>

        {/* Taste Gravity */}
        <section className="flex flex-col gap-3 md:gap-4" aria-labelledby="taste-heading" data-tour="analytics-taste">
          <h2 id="taste-heading" className={`${eyebrow} flex min-h-11 items-center px-2`}>Taste gravity</h2>
          <TasteGravity groupId={groupId || ''} range={range} viewerId={user?._id} />
        </section>

        {/* Hall of Fame */}
        <section className="flex flex-col gap-3 md:gap-4" aria-labelledby="hall-of-fame-heading" data-tour="analytics-halloffame">
          <h2 id="hall-of-fame-heading" className={`${eyebrow} flex min-h-11 items-center px-2`}>Hall of fame</h2>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading the hall of fame">
              {HALL_OF_FAME.map(({ kind }) => <Skeleton key={kind} className="h-40 w-full rounded-2xl" />)}
            </div>
          ) : HALL_OF_FAME.some(({ kind }) => superlatives[kind]) ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {HALL_OF_FAME.map(({ kind, title }) => {
                const holder = superlatives[kind];
                return holder ? (
                  <SuperlativeCard
                    key={kind}
                    kind={kind}
                    title={title}
                    user={holder.user}
                    value={holder.value}
                    isViewer={!!user && holder.user._id === user._id}
                  />
                ) : null;
              })}
            </div>
          ) : (
            <div className={card}>
              <p className="text-base font-medium text-foreground">
                {range === 'all'
                  ? 'No data available for superlatives yet.'
                  : `Nobody shared, liked or listened in the last ${range === '7d' ? '7' : '30'} days. Try All.`}
              </p>
            </div>
          )}
        </section>

      </main>
    </>
  );
}
