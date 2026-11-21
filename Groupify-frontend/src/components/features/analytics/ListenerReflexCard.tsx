import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Skeleton } from '../../ui/skeleton';
import { useIsMobile } from '../../ui/use-mobile';
import { useListenerReflex, type ListenerReflexRange, type ListenerReflexMode } from '../../../hooks/useListenerReflex';
import { formatTime } from '../../../lib/formatTime';
import { cn } from '../../../lib/utils';
import type { ListenerReflexUser, ReflexCategory } from '../../../types';
import { Zap, Clock, TrendingUp, Timer } from 'lucide-react';
import ListenerReflexComparePanel from './listenerReflex/ListenerReflexComparePanel';
import { getListeningStyleLabel } from '../../../utils/getListeningStyleLabel';
import { useAiInsights } from '../../../hooks/useAiInsights';

interface ListenerReflexCardProps {
  groupId: string;
  range: ListenerReflexRange;
  mode: ListenerReflexMode;
  isCompareMode: boolean;
}

const CATEGORY_CONFIG: Record<ReflexCategory, { label: string; color: string; icon: typeof Zap }> = {
  instant: { label: 'Instant Reactor', color: 'bg-selected text-foreground border-line', icon: Zap },
  quick: { label: 'Quick', color: 'bg-selected text-soft border-line', icon: Clock },
  slow: { label: 'Slow Burn', color: 'bg-selected text-soft border-line', icon: TrendingUp },
  longTail: { label: 'Long Tail', color: 'bg-muted text-muted-foreground border-border', icon: Timer }
};

// ─── Timeline strip chart helpers ───────────────────────────────────────────

/**
 * Map a timestamp to X position in the chart.
 * @param timestamp ISO string
 * @param minTime earliest timestamp (ms since epoch)
 * @param maxTime latest timestamp (ms since epoch)
 * @param chartLeft left padding of the chart area
 * @param chartWidth usable width of the chart area
 * @returns x coordinate
 */
const mapTimestampToX = (
  timestamp: string,
  minTime: number,
  maxTime: number,
  chartLeft: number,
  chartWidth: number
): number => {
  const t = new Date(timestamp).getTime();
  if (maxTime === minTime) return chartLeft + chartWidth / 2;
  const ratio = (t - minTime) / (maxTime - minTime);
  return chartLeft + ratio * chartWidth;
};

// Y-axis ceiling per range so short-range charts aren't compressed against a 30d scale
const RANGE_MAX_MS: Record<ListenerReflexRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  'all': 90 * 24 * 60 * 60 * 1000,
};

/**
 * Map reaction time (ms) to Y position using log scale, inverted (fast = top).
 * maxMs should match the active range so the scale is meaningful.
 */
const mapReactionTimeToY = (
  reactionMs: number,
  chartTop: number,
  chartHeight: number,
  maxMs: number
): number => {
  const MIN_MS = 1000; // 1 second floor
  const clamped = Math.max(MIN_MS, Math.min(reactionMs, maxMs));
  const logMin = Math.log(MIN_MS);
  const logMax = Math.log(maxMs);
  const t = (Math.log(clamped) - logMin) / (logMax - logMin); // 0 = fast, 1 = slow
  return chartTop + t * chartHeight; // fast at top, slow at bottom
};

/**
 * Format a timestamp for axis display.
 */
const formatAxisDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
};

// SVG viewBox units for the timeline strip chart
const SVG_WIDTH = 300;
const SVG_HEIGHT = 80;
const CHART_LEFT = 30;   // space for "Fast"/"Slow" labels
const CHART_RIGHT = 10;
const CHART_TOP = 4;
const CHART_BOTTOM = 16; // space for date labels
const CHART_WIDTH = SVG_WIDTH - CHART_LEFT - CHART_RIGHT;
const CHART_HEIGHT = SVG_HEIGHT - CHART_TOP - CHART_BOTTOM;

export default function ListenerReflexCard({ groupId, range, mode, isCompareMode }: ListenerReflexCardProps) {
  const isMobile = useIsMobile();

  const { data, isLoading, error } = useListenerReflex(groupId, range, mode);
  const { data: aiInsights, isLoading: aiLoading } = useAiInsights(groupId, 'reflex', range, mode);

  // Calculate group average listens for relative engagement comparison
  const groupAverageListens = useMemo(() => {
    if (!data || data.users.length === 0) return 0;
    const totalListens = data.users.reduce((sum, user) => sum + user.listens, 0);
    return totalListens / data.users.length;
  }, [data]);

  // Build timeline visualization data — pair each user with their ring data points
  const timelineData = useMemo(() => {
    if (!data || !data.ringData || data.ringData.length === 0) return null;

    const usersWithTimeline = data.users
      .map(user => {
        const ringData = data.ringData.find(rd => rd.userId === user.userId);
        if (!ringData) return null;
        return { user, ringData };
      })
      .filter((item): item is {
        user: ListenerReflexUser;
        ringData: { userId: string; points: Array<{ ms: number; listenedAt: string }> };
      } => item !== null);

    return { usersWithTimeline };
  }, [data]);

  if (isLoading) {
    return (
      <Card className="w-full bg-card/50 backdrop-blur-sm border-hair">
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-card/50 backdrop-blur-sm border-hair border-destructive/50">
        <CardContent className="p-6">
          <p className="text-destructive text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.users.length === 0) {
    return (
      <Card className="w-full bg-card/50 backdrop-blur-sm border-hair">
        <CardHeader>
          <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Listener Reflex
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No listener data available for this range.</p>
        </CardContent>
      </Card>
    );
  }

  const groupMedianMs = data.summary.groupMedianMs;
  const dotRadius = isMobile ? 4 : 3;
  const yAxisMaxMs = RANGE_MAX_MS[range];

  return (
    <Card className="w-full bg-card/50 backdrop-blur-sm border-hair">
      <CardHeader>
        <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Listener Reflex
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Compare Mode Panel */}
        {isCompareMode ? (
          <div className="transition-all duration-200 space-y-3">
            {range === '24h' && (
              <p className="text-xs text-muted-foreground px-1">
                Compare uses <span className="text-foreground font-medium">7-day</span> data — the 24h window is too narrow for a meaningful radar comparison.
              </p>
            )}
            <ListenerReflexComparePanel
              groupId={groupId}
              window={range === '24h' ? '7d' : (range === 'all' ? 'all' : range)}
              mode={mode}
            />
          </div>
        ) : (
          <>
            {/* Timeline Strip Charts */}
            {timelineData && timelineData.usersWithTimeline.length > 0 && (
              <div className="w-full">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Reaction Timeline</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {timelineData.usersWithTimeline.map(({ user, ringData }) => {
                    const hasPoints = ringData.points && ringData.points.length > 0;

                    // Compute date range for X axis
                    let minTime = 0;
                    let maxTime = 0;
                    if (hasPoints) {
                      const timestamps = ringData.points.map(p => new Date(p.listenedAt).getTime());
                      minTime = Math.min(...timestamps);
                      maxTime = Math.max(...timestamps);
                      // Add a small buffer if all timestamps are the same
                      if (maxTime === minTime) {
                        minTime -= 3600_000;
                        maxTime += 3600_000;
                      }
                    }

                    // Compute user median Y position
                    const userMedianY = user.medianMs !== null
                      ? mapReactionTimeToY(user.medianMs, CHART_TOP, CHART_HEIGHT, yAxisMaxMs)
                      : null;

                    // Compute group median Y position
                    const groupMedianY = groupMedianMs > 0
                      ? mapReactionTimeToY(groupMedianMs, CHART_TOP, CHART_HEIGHT, yAxisMaxMs)
                      : null;

                    // Badge / style label
                    const styleLabel = getListeningStyleLabel(
                      user,
                      ringData,
                      range,
                      groupAverageListens,
                      groupMedianMs,
                      data.users.length
                    );
                    const BadgeIcon = styleLabel.badge.icon;

                    return (
                      <Card
                        key={user.userId}
                        className="bg-card/50 border-hair p-4 transition-all duration-150"
                      >
                        <div className="flex flex-col gap-3 w-full">
                          {/* Header: Avatar + Name + Stats */}
                          <div className="flex items-center gap-2 w-full">
                            <Avatar className="w-8 h-8 border border-hair flex-shrink-0">
                              <AvatarImage src={user.avatarUrl || undefined} />
                              <AvatarFallback className="text-xs">
                                {user.displayName.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{user.displayName}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs flex-shrink-0">
                              <div className="text-right">
                                <p className="text-muted-foreground text-[10px]">Listens</p>
                                <p className="font-semibold">{user.listens}</p>
                              </div>
                              {user.medianMs !== null && (
                                <>
                                  <div className="w-px h-6 bg-border" />
                                  <div className="text-right">
                                    <p className="text-muted-foreground text-[10px]">Median</p>
                                    <p className="font-semibold">{formatTime(user.medianMs)}</p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Listening Style Badge + Description */}
                          <div className="flex flex-col gap-2">
                            <div
                              className="w-fit inline-flex items-center gap-1.5 px-2 py-1 border border-line bg-selected text-soft rounded-md text-xs font-medium"
                            >
                              <BadgeIcon className="w-3 h-3 shrink-0" />
                              <span>{styleLabel.title}</span>
                            </div>
                            {aiLoading ? (
                              <div className="space-y-1.5">
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-3/4" />
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground leading-relaxed animate-in fade-in duration-300 flex items-start gap-1">
                                {aiInsights?.[user.userId] && (
                                  <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z" />
                                  </svg>
                                )}
                                {aiInsights?.[user.userId] ?? styleLabel.description}
                              </p>
                            )}
                          </div>

                          {/* Timeline Strip Chart */}
                          {hasPoints ? (
                            <svg
                              width="100%"
                              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                              preserveAspectRatio="xMidYMid meet"
                              className="mt-1"
                              style={{ minHeight: '80px' }}
                            >
                              {/* Y-axis labels */}
                              <text x={CHART_LEFT - 3} y={CHART_TOP + 6} textAnchor="end" fontSize="7" fill="var(--text-quiet)">Fast</text>
                              <text x={CHART_LEFT - 3} y={CHART_TOP + CHART_HEIGHT} textAnchor="end" fontSize="7" fill="var(--text-quiet)">Slow</text>

                              {/* Chart border */}
                              <rect
                                x={CHART_LEFT}
                                y={CHART_TOP}
                                width={CHART_WIDTH}
                                height={CHART_HEIGHT}
                                fill="none"
                                stroke="var(--hair)"
                                strokeWidth="0.5"
                              />

                              {/* Group median reference line (dashed) */}
                              {groupMedianY !== null && (
                                <>
                                  <line
                                    x1={CHART_LEFT}
                                    y1={groupMedianY}
                                    x2={CHART_LEFT + CHART_WIDTH}
                                    y2={groupMedianY}
                                    stroke="var(--line)"
                                    strokeWidth="0.7"
                                    strokeDasharray="4,3"
                                  />
                                  <text
                                    x={CHART_LEFT + CHART_WIDTH + 1}
                                    y={groupMedianY + 2.5}
                                    fontSize="5.5"
                                    fill="var(--text-quiet)"
                                  >
                                    grp
                                  </text>
                                </>
                              )}

                              {/* User median reference line (solid) */}
                              {userMedianY !== null && (
                                <>
                                  <line
                                    x1={CHART_LEFT}
                                    y1={userMedianY}
                                    x2={CHART_LEFT + CHART_WIDTH}
                                    y2={userMedianY}
                                    stroke="var(--text-soft)"
                                    strokeWidth="0.8"
                                  />
                                  <text
                                    x={CHART_LEFT + CHART_WIDTH + 1}
                                    y={userMedianY + 2.5}
                                    fontSize="5.5"
                                    fill="var(--text-soft)"
                                  >
                                    med
                                  </text>
                                </>
                              )}

                              {/* Data points */}
                              {ringData.points.slice(0, 50).map((point, i) => {
                                const x = mapTimestampToX(point.listenedAt, minTime, maxTime, CHART_LEFT, CHART_WIDTH);
                                const y = mapReactionTimeToY(point.ms, CHART_TOP, CHART_HEIGHT, yAxisMaxMs);
                                return (
                                  <circle
                                    key={i}
                                    cx={x}
                                    cy={y}
                                    r={dotRadius}
                                    fill="var(--text)"
                                    opacity={0.75}
                                  />
                                );
                              })}

                              {/* X-axis date labels */}
                              <text x={CHART_LEFT} y={SVG_HEIGHT - 2} fontSize="6.5" fill="var(--text-quiet)">
                                {formatAxisDate(minTime)}
                              </text>
                              <text x={CHART_LEFT + CHART_WIDTH} y={SVG_HEIGHT - 2} textAnchor="end" fontSize="6.5" fill="var(--text-quiet)">
                                {formatAxisDate(maxTime)}
                              </text>
                            </svg>
                          ) : (
                            <p className="text-xs text-muted-foreground italic text-center py-4">
                              No listens in this period
                            </p>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Member Rankings */}
            <div className="w-full">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Member Rankings</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.users
                  .filter(user => user.medianMs !== null && user.category !== null)
                  .map((user, index) => {
                    const categoryConfig = CATEGORY_CONFIG[user.category!];
                    const CategoryIcon = categoryConfig.icon;

                    return (
                      <div
                        key={user.userId}
                        className={cn(
                          'flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg border transition-colors',
                          'bg-card/50 border-hair hover:bg-selected',
                          'flex-wrap sm:flex-nowrap'
                        )}
                      >
                        {/* Rank */}
                        <div className="flex-shrink-0 w-6 md:w-8 text-center">
                          <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                        </div>

                        {/* Avatar */}
                        <Avatar className="w-8 h-8 md:w-10 md:h-10 border border-hair flex-shrink-0">
                          <AvatarImage src={user.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs md:text-sm">{user.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>

                        {/* Name */}
                        <div className="flex-1 min-w-0 flex-shrink">
                          <p className="font-medium text-xs md:text-sm truncate">{user.displayName}</p>
                          <p className="text-[10px] md:text-xs text-muted-foreground">
                            {user.listens} {user.listens === 1 ? 'listen' : 'listens'}
                          </p>
                        </div>

                        {/* Category Badge */}
                        <Badge
                          variant="outline"
                          className={cn(
                            'flex items-center gap-1 flex-shrink-0',
                            isMobile ? 'px-2 py-1.5' : 'px-2 md:px-2.5 py-1 md:py-1.5',
                            categoryConfig.color
                          )}
                        >
                          <CategoryIcon className={cn(
                            'flex-shrink-0',
                            isMobile ? 'w-3 h-3' : 'w-2.5 h-2.5 md:w-3 md:h-3'
                          )} />
                          {!isMobile && (
                            <span className="text-[10px] md:text-[11px] whitespace-nowrap font-medium">
                              {categoryConfig.label}
                            </span>
                          )}
                        </Badge>

                        {/* Median Time */}
                        <div className="flex-shrink-0 text-right min-w-[60px] md:min-w-0">
                          <p className="text-xs md:text-sm font-semibold whitespace-nowrap">{formatTime(user.medianMs!)}</p>
                          <p className="text-[10px] md:text-xs text-muted-foreground">median</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
