import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Skeleton } from '../../ui/skeleton';
import { useIsMobile } from '../../ui/use-mobile';
import { useListenerReflex, type ListenerReflexRange, type ListenerReflexMode } from '../../../hooks/useListenerReflex';
import { formatTime } from '../../../lib/formatTime';
import { cn } from '../../ui/utils';
import type { ListenerReflexUser, ReflexCategory } from '../../../types';
import { Zap, Clock, TrendingUp, Timer } from 'lucide-react';
import { getListeningStyleLabel } from '../../../utils/getListeningStyleLabel';

interface ListenerReflexCardProps {
  groupId: string;
}

const CATEGORY_CONFIG: Record<ReflexCategory, { label: string; color: string; icon: typeof Zap }> = {
  instant: { label: 'Instant Reactor', color: 'bg-primary text-black', icon: Zap },
  quick: { label: 'Quick', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock },
  slow: { label: 'Slow Burn', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: TrendingUp },
  longTail: { label: 'Long Tail', color: 'bg-muted text-muted-foreground border-border', icon: Timer }
};

/**
 * Calculate standard deviation of timeToListen values
 * @param points - Array of points with ms (timeToListen in milliseconds)
 * @returns Standard deviation in milliseconds
 */
const calculateStandardDeviation = (points: Array<{ ms: number }>): number => {
  if (points.length === 0) return 0;
  if (points.length === 1) return 0;
  
  // Calculate mean
  const mean = points.reduce((sum, p) => sum + p.ms, 0) / points.length;
  
  // Calculate variance
  const variance = points.reduce((sum, p) => sum + Math.pow(p.ms - mean, 2), 0) / points.length;
  
  // Return standard deviation
  return Math.sqrt(variance);
};

/**
 * Calculate dynamic arc span based on statistical variance of reaction times
 * Low variance (consistent) = small arc (20-40°)
 * High variance (inconsistent) = large arc (up to 330°)
 * 
 * @param points - Array of points with ms (timeToListen in milliseconds)
 * @returns Arc span in radians
 */
const calculateDynamicArcSpan = (points: Array<{ ms: number }>): number => {
  if (points.length === 0) return 0;
  if (points.length === 1) {
    // Single point: use minimal arc for visual clarity
    return (20 * Math.PI) / 180; // 20 degrees
  }
  
  const stdDev = calculateStandardDeviation(points);
  const mean = points.reduce((sum, p) => sum + p.ms, 0) / points.length;
  
  // Use coefficient of variation (CV) for scale-independent measure
  // CV = stdDev / mean (handles cases where mean is 0 or very small)
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
  
  // Normalize CV to [0, 1] range
  // CV typically ranges from 0 (perfectly consistent) to 2+ (highly variable)
  // We'll cap it at 2 for normalization purposes
  const normalizedVariance = Math.min(coefficientOfVariation / 2, 1);
  
  // Map normalized variance to arc span
  // Low variance (0) → small arc (20° = 0.35 radians)
  // High variance (1) → large arc (330° = 1.83π radians)
  const MIN_ARC_DEGREES = 20;
  const MAX_ARC_DEGREES = 330;
  const MIN_ARC_RADIANS = (MIN_ARC_DEGREES * Math.PI) / 180;
  const MAX_ARC_RADIANS = (MAX_ARC_DEGREES * Math.PI) / 180;
  
  // Linear interpolation: small arc for consistent, large arc for inconsistent
  const arcSpan = MIN_ARC_RADIANS + normalizedVariance * (MAX_ARC_RADIANS - MIN_ARC_RADIANS);
  
  return arcSpan;
};

/**
 * Compute angle for a point in an arc using value-based spacing
 * Points are positioned based on their actual timeToListen values relative to min/max,
 * creating visual clusters for similar values and gaps for outliers.
 * 
 * @param value - The timeToListen value in milliseconds for this point
 * @param minValue - Minimum timeToListen value in the current set
 * @param maxValue - Maximum timeToListen value in the current set
 * @param arcSpan - Dynamic arc span in radians (calculated from variance)
 * @returns Angle in radians, centered around 0
 */
const computePointAngle = (
  value: number,
  minValue: number,
  maxValue: number,
  arcSpan: number
): number => {
  // Handle edge case: all values are the same (or single point)
  if (maxValue === minValue) {
    return 0; // Place at center
  }
  
  // Normalize value to [0, 1] range based on actual timeToListen values
  // value = minValue -> normalizedValue = 0 (fastest, left side of arc)
  // value = maxValue -> normalizedValue = 1 (slowest, right side of arc)
  const normalizedValue = (value - minValue) / (maxValue - minValue);
  
  // Map normalized value to arc: centered around 0, spanning from -arcSpan/2 to +arcSpan/2
  // This ensures points with similar values cluster together, and outliers create visible gaps
  return -arcSpan / 2 + normalizedValue * arcSpan;
};

/**
 * Linear interpolation between two RGB colors
 * @param startColor - RGB array [r, g, b] for old/muted color
 * @param endColor - RGB array [r, g, b] for new/bright color
 * @param t - Interpolation factor (0 = startColor, 1 = endColor)
 * @returns RGB color string "rgb(r, g, b)"
 */
const lerpColor = (startColor: [number, number, number], endColor: [number, number, number], t: number): string => {
  const clampedT = Math.max(0, Math.min(1, t));
  const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * clampedT);
  const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * clampedT);
  const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * clampedT);
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Compute dot radius from timeToListen using log-normalized scaling
 * Inverted mapping: fast reactions (small ms) -> inner radius, slow reactions (large ms) -> outer radius
 * Log scaling compresses long tails and provides better separation across seconds→days
 * 
 * @param timeToListenMs - Time to listen in milliseconds
 * @param activeWindowMs - Active time window in milliseconds (from range filter)
 * @param innerRadius - Inner radius bound (fast reactions)
 * @param outerRadius - Outer radius bound (slow reactions)
 * @returns Radius value clamped to [innerRadius, outerRadius]
 */
const computeDotRadius = (
  timeToListenMs: number,
  activeWindowMs: number,
  innerRadius: number,
  outerRadius: number
): number => {
  // Clamp time to avoid log(0) and ensure stability
  const MIN_MS = 1000; // 1 second floor
  const MAX_MS = activeWindowMs; // Use active window as max
  
  const clampedTime = Math.max(MIN_MS, Math.min(timeToListenMs, MAX_MS));
  
  // Log-normalized scaling: t in [0,1] where 0 = fast, 1 = slow
  const logMin = Math.log(MIN_MS);
  const logMax = Math.log(MAX_MS);
  const logTime = Math.log(clampedTime);
  const t = (logTime - logMin) / (logMax - logMin);
  
  // Inverted mapping: fast (t=0) -> inner, slow (t=1) -> outer
  const radius = innerRadius + t * (outerRadius - innerRadius);
  
  // Clamp to bounds for safety
  return Math.max(innerRadius, Math.min(radius, outerRadius));
};

/**
 * Compute recency factor and visual properties for a dot
 * Encodes recency using both opacity and color desaturation
 * Newer listens: bright accent green + high opacity
 * Older listens: muted gray-green + low opacity
 * 
 * @param listenTimestamp - Timestamp when the listen occurred (ISO string or Date)
 * @param activeRange - Active time range filter ('7d' | '30d' | '90d')
 * @returns Object with opacity (0.15-1.0) and color (RGB string)
 */
const getDotRecency = (listenTimestamp: string | Date, activeRange: ListenerReflexRange): { opacity: number; color: string } => {
  const now = Date.now();
  const listenTime = typeof listenTimestamp === 'string' 
    ? new Date(listenTimestamp).getTime() 
    : listenTimestamp.getTime();
  
  // Calculate age in milliseconds
  const ageMs = now - listenTime;
  
  // Map active range to milliseconds
  const rangeMsMap: Record<ListenerReflexRange, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000
  };
  const activeWindowMs = rangeMsMap[activeRange];
  
  // Calculate recency factor: t = 1 (newest) to 0 (oldest)
  const t = Math.max(0, Math.min(1, 1 - (ageMs / activeWindowMs)));
  
  // Opacity: newer = higher opacity, older = lower opacity
  // Range: 0.15 (minimum visibility) to 1.0 (full brightness)
  const opacity = Math.max(0.15, Math.min(1, 0.15 + 0.85 * t));
  
  // Color: interpolate between muted gray-green (old) and bright accent green (new)
  // startColor = muted gray-green for old dots
  // endColor = bright accent green (#00FF88) for new dots
  const startColor: [number, number, number] = [120, 160, 140]; // muted green-gray
  const endColor: [number, number, number] = [0, 255, 136]; // accent green #00FF88
  const color = lerpColor(startColor, endColor, t);
  
  return { opacity, color };
};


/**
 * Minimal Recency Legend Component
 * Shows visual guide for recency encoding (color + opacity)
 */
const RecencyLegend = () => {
  const dots = [
    { t: 0, opacity: 0.4 },    // Oldest (increased for visibility)
    { t: 0.33, opacity: 0.6 }, // 
    { t: 0.67, opacity: 0.85 },  // 
    { t: 1, opacity: 1.0 }       // Recent
  ];

  const startColor: [number, number, number] = [120, 160, 140];
  const endColor: [number, number, number] = [0, 255, 136];

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="whitespace-nowrap">Recency</span>
      <div className="flex items-center gap-1.5">
        {dots.map((dot, index) => {
          const color = lerpColor(startColor, endColor, dot.t);
          return (
            <span
              key={index}
              className="inline-block rounded-full flex-shrink-0"
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: color,
                opacity: dot.opacity,
                minWidth: '10px',
                minHeight: '10px'
              }}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <span className="whitespace-nowrap">Older → Recent</span>
    </div>
  );
};

export default function ListenerReflexCard({ groupId }: ListenerReflexCardProps) {
  const [range, setRange] = useState<ListenerReflexRange>('30d');
  const [mode, setMode] = useState<ListenerReflexMode>('received');
  const isMobile = useIsMobile();
  
  const { data, isLoading, error } = useListenerReflex(groupId, range, mode);

  // Calculate group average listens for relative engagement comparison
  const groupAverageListens = useMemo(() => {
    if (!data || data.users.length === 0) return 0;
    const totalListens = data.users.reduce((sum, user) => sum + user.listens, 0);
    return totalListens / data.users.length;
  }, [data]);

  // Calculate ring visualization data - use all users with data
  const ringVisualizationData = useMemo(() => {
    if (!data || !data.ringData || data.ringData.length === 0) return null;

    // Calculate max time across all users for consistent scaling
    // Extract ms values from points array
    const maxTime = Math.max(
      ...data.ringData.flatMap(rd => rd.points.map(p => p.ms)),
      1
    );
    
    // Match users with their ring data
    const usersWithRings = data.users
      .map(user => {
        const ringData = data.ringData.find(rd => rd.userId === user.userId);
        if (!ringData) return null;
        
        return { user, ringData };
      })
      .filter((item): item is { 
        user: ListenerReflexUser; 
        ringData: { userId: string; points: Array<{ ms: number; listenedAt: string }> };
      } => item !== null);
    
    return {
      usersWithRings,
      maxTime
    };
  }, [data]);

  if (isLoading) {
    return (
      <Card className="w-full bg-card/50 backdrop-blur-sm border-white/5">
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
      <Card className="w-full bg-card/50 backdrop-blur-sm border-white/5 border-destructive/50">
        <CardContent className="p-6">
          <p className="text-destructive text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.users.length === 0) {
    return (
      <Card className="w-full bg-card/50 backdrop-blur-sm border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Listener Reflex
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No listener data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <style>{`
        .group:hover .arc-boundary-guide {
          opacity: 0.38 !important;
          stroke-width: 2px;
        }
      `}</style>
      <Card className="w-full bg-card/50 backdrop-blur-sm border-white/5">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Listener Reflex
          </CardTitle>
          
          {/* Range Selector */}
          <div className="flex gap-2">
            {(['24h', '7d', '30d', '90d'] as ListenerReflexRange[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? 'default' : 'outline'}
                onClick={() => setRange(r)}
                className={cn(
                  'h-8 px-3 text-xs',
                  range === r
                    ? 'bg-primary hover:bg-primary/90 text-black'
                    : 'border-primary/30 hover:bg-primary/10'
                )}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">Mode:</span>
          <div className="flex gap-2">
            {(['received', 'shared'] as ListenerReflexMode[]).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? 'default' : 'outline'}
                onClick={() => setMode(m)}
                className={cn(
                  'h-8 px-3 text-xs',
                  mode === m
                    ? 'bg-primary hover:bg-primary/90 text-black'
                    : 'border-primary/30 hover:bg-primary/10'
                )}
              >
                {m === 'received' ? 'Received' : 'Shared'}
              </Button>
            ))}
          </div>
          {/* Mode Indicator */}
          <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs font-medium text-primary">
              {mode === 'received' 
                ? 'How fast members listen to shared songs' 
                : 'How fast others react to this member\'s shares'}
            </span>
          </div>
        </div>

        {/* Summary Line */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Group Median:</span>
            <span className="font-semibold text-foreground">
              {formatTime(data.summary.groupMedianMs)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Instant Reactors:</span>
            <span className="font-semibold text-primary">
              {data.summary.instantReactorCount}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Reaction Rings Visualization */}
        {ringVisualizationData && ringVisualizationData.usersWithRings.length > 0 && (
          <div className="w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Reaction Rings</h3>
              <RecencyLegend />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ringVisualizationData.usersWithRings.map(({ user, ringData }) => {
                if (!ringData.points || ringData.points.length === 0) return null;

                // Sort points by timeToListen (fast → slow) to encode consistency in angular spread
                const sortedPoints = [...ringData.points].sort((a, b) => a.ms - b.ms);
                const pointsToRender = sortedPoints.slice(0, 50);

                // Calculate min/max timeToListen values for value-based angle calculation
                // This allows points with similar values to cluster together
                const timeValues = pointsToRender.map(p => p.ms);
                const minTimeValue = Math.min(...timeValues);
                const maxTimeValue = Math.max(...timeValues);

                // Calculate dynamic arc span based on statistical variance
                // Low variance (consistent) = small arc, high variance (inconsistent) = large arc
                const dynamicArcSpan = calculateDynamicArcSpan(pointsToRender);

                const centerX = 60;
                const centerY = 60;
                const baseRadius = 40; // Same size for all rings
                const FIXED_DOT_RADIUS = 3; // Fixed dot size for all dots
                
                return (
                  <Card
                    key={user.userId}
                    className="bg-card/50 border-white/5 p-4 group transition-all duration-150"
                  >
                    <div className="flex flex-col items-center gap-3">
                      {/* Avatar, Name, and Stats */}
                      <div className="flex flex-col gap-3 w-full">
                        <div className="flex items-center gap-2 w-full">
                          <Avatar className="w-8 h-8 border border-white/10 flex-shrink-0">
                            <AvatarImage src={user.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {user.displayName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{user.displayName}</p>
                          </div>
                          {/* Stats moved to top row */}
                          <div className="flex items-center gap-2 text-xs flex-shrink-0">
                            <div className="text-right">
                              <p className="text-muted-foreground text-[10px]">Listens</p>
                              <p className="font-semibold">{user.listens}</p>
                            </div>
                            <div className="w-px h-6 bg-border" />
                            <div className="text-right">
                              <p className="text-muted-foreground text-[10px]">Median</p>
                              <p className="font-semibold">{formatTime(user.medianMs)}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Listening Style Label */}
                        {(() => {
                          const styleLabel = getListeningStyleLabel(
                            user,
                            ringData,
                            range,
                            groupAverageListens
                          );
                          const BadgeIcon = styleLabel.badge.icon;
                          
                          // Parse Tailwind color classes to inline styles
                          const getColorValue = (colorClass: string): string => {
                            // Map Tailwind color names to actual hex values
                            const colorMap: Record<string, string> = {
                              'text-yellow-400': '#facc15',
                              'text-primary': '#00FF88',
                              'text-purple-400': '#c084fc',
                              'text-amber-400': '#fbbf24',
                              'text-blue-400': '#60a5fa',
                              'text-indigo-400': '#818cf8',
                              'text-cyan-400': '#22d3ee',
                              'text-teal-400': '#2dd4bf',
                              'text-green-400': '#4ade80',
                              'text-orange-400': '#fb923c',
                              'text-red-400': '#f87171',
                              'text-pink-400': '#f472b6',
                              'text-slate-400': '#94a3b8',
                              'text-muted-foreground': 'var(--muted-foreground)',
                            };
                            return colorMap[colorClass] || '#ffffff';
                          };
                          
                          const getBgValue = (bgClass: string): string => {
                            const bgMap: Record<string, string> = {
                              'bg-yellow-500/20': 'rgba(234, 179, 8, 0.2)',
                              'bg-primary/20': 'rgba(0, 255, 136, 0.2)',
                              'bg-purple-500/20': 'rgba(168, 85, 247, 0.2)',
                              'bg-amber-500/20': 'rgba(245, 158, 11, 0.2)',
                              'bg-blue-500/20': 'rgba(59, 130, 246, 0.2)',
                              'bg-indigo-500/20': 'rgba(99, 102, 241, 0.2)',
                              'bg-cyan-500/20': 'rgba(6, 182, 212, 0.2)',
                              'bg-teal-500/20': 'rgba(20, 184, 166, 0.2)',
                              'bg-green-500/20': 'rgba(34, 197, 94, 0.2)',
                              'bg-orange-500/20': 'rgba(249, 115, 22, 0.2)',
                              'bg-red-500/20': 'rgba(239, 68, 68, 0.2)',
                              'bg-pink-500/20': 'rgba(236, 72, 153, 0.2)',
                              'bg-slate-500/20': 'rgba(100, 116, 139, 0.2)',
                              'bg-muted/20': 'rgba(var(--muted), 0.2)',
                            };
                            return bgMap[bgClass] || 'rgba(0, 0, 0, 0.1)';
                          };
                          
                          const getBorderValue = (borderClass: string): string => {
                            const borderMap: Record<string, string> = {
                              'border-yellow-500/30': 'rgba(234, 179, 8, 0.3)',
                              'border-primary/30': 'rgba(0, 255, 136, 0.3)',
                              'border-purple-500/30': 'rgba(168, 85, 247, 0.3)',
                              'border-amber-500/30': 'rgba(245, 158, 11, 0.3)',
                              'border-blue-500/30': 'rgba(59, 130, 246, 0.3)',
                              'border-indigo-500/30': 'rgba(99, 102, 241, 0.3)',
                              'border-cyan-500/30': 'rgba(6, 182, 212, 0.3)',
                              'border-teal-500/30': 'rgba(20, 184, 166, 0.3)',
                              'border-green-500/30': 'rgba(34, 197, 94, 0.3)',
                              'border-orange-500/30': 'rgba(249, 115, 22, 0.3)',
                              'border-red-500/30': 'rgba(239, 68, 68, 0.3)',
                              'border-pink-500/30': 'rgba(236, 72, 153, 0.3)',
                              'border-slate-500/30': 'rgba(100, 116, 139, 0.3)',
                              'border-border': 'var(--border)',
                            };
                            return borderMap[borderClass] || 'rgba(255, 255, 255, 0.1)';
                          };
                          
                          return (
                            <div className="flex flex-col gap-2">
                              <div
                                className="w-fit inline-flex items-center gap-1.5 px-2 py-1 border rounded-md text-xs font-medium"
                                style={{
                                  backgroundColor: getBgValue(styleLabel.badge.bgColor),
                                  borderColor: getBorderValue(styleLabel.badge.borderColor),
                                  color: getColorValue(styleLabel.badge.color),
                                }}
                              >
                                <BadgeIcon className="w-3 h-3 shrink-0" />
                                <span>{styleLabel.title}</span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {styleLabel.description}
                              </p>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Mini Ring SVG */}
                      <div className="relative w-40 h-40 flex items-center justify-center overflow-hidden">
                        <svg width="160" height="160" viewBox="0 0 120 120" className="w-full h-full">
                          {/* Grid circles */}
                          {[1, 2, 3].map((i) => (
                            <circle
                              key={i}
                              cx={centerX}
                              cy={centerY}
                              r={baseRadius * (i / 3)}
                              fill="none"
                              stroke="rgba(255,255,255,0.05)"
                              strokeWidth="0.5"
                            />
                          ))}
                          
                          {/* Ring circle outline */}
                          <circle
                            cx={centerX}
                            cy={centerY}
                            r={baseRadius}
                            fill="none"
                            stroke="rgba(0,255,136,0.2)"
                            strokeWidth="1"
                            strokeDasharray="2,2"
                          />
                          
                          {/* Arc Boundary Guide: shows the dynamic arc span used for dot placement (encodes consistency) */}
                          {(() => {
                            // Use the calculated dynamic arc span for this user
                            const startAngle = -dynamicArcSpan / 2;
                            const endAngle = dynamicArcSpan / 2;
                            
                            // Use a radius that matches the dot track (slightly outside the average dot position)
                            // Dots are placed between baseRadius * 0.3 and baseRadius * 0.7
                            // Use baseRadius * 0.75 to be slightly outside the outer edge of dots
                            const guideRadius = baseRadius * 0.75;
                            
                            // Compute arc path endpoints
                            const startX = centerX + guideRadius * Math.cos(startAngle);
                            const startY = centerY + guideRadius * Math.sin(startAngle);
                            const endX = centerX + guideRadius * Math.cos(endAngle);
                            const endY = centerY + guideRadius * Math.sin(endAngle);
                            
                            // Large arc flag: 1 if arc spans more than 180 degrees
                            const largeArcFlag = dynamicArcSpan > Math.PI ? 1 : 0;
                            
                            return (
                              <path
                                className="arc-boundary-guide transition-all duration-150"
                                d={`M ${startX} ${startY} A ${guideRadius} ${guideRadius} 0 ${largeArcFlag} 1 ${endX} ${endY}`}
                                fill="none"
                                stroke="rgb(0,255,136)"
                                strokeWidth="1.25"
                                strokeDasharray="6,6"
                                opacity="0.22"
                                style={{
                                  transition: 'opacity 150ms ease-out, stroke-width 150ms ease-out'
                                }}
                              />
                            );
                          })()}
                          
                          {/* Data points - sorted by timeToListen, mapped to arc for consistency visualization */}
                          {pointsToRender.map((point, pointIndex) => {
                            // Radius calculation: log-normalized scaling with inverted mapping
                            // Fast reactions (small ms) -> inner radius, slow reactions (large ms) -> outer radius
                            // Log scaling compresses long tails and provides better separation
                            const rangeMsMap: Record<ListenerReflexRange, number> = {
                              '24h': 24 * 60 * 60 * 1000,
                              '7d': 7 * 24 * 60 * 60 * 1000,
                              '30d': 30 * 24 * 60 * 60 * 1000,
                              '90d': 90 * 24 * 60 * 60 * 1000
                            };
                            const activeWindowMs = rangeMsMap[range];
                            const innerRadius = baseRadius * 0.15; // Tightened from 0.3 to increase visual contrast
                            const outerRadius = baseRadius * 0.7;
                            const radius = computeDotRadius(point.ms, activeWindowMs, innerRadius, outerRadius);
                            
                            // Angle: map to dynamic arc based on actual timeToListen value (value-based spacing)
                            // Points with similar timeToListen values cluster together
                            // Outliers (like a 6-day listen vs 13-hour listens) create visible gaps
                            // Fast reactions at start of arc, slow reactions at end
                            const angle = computePointAngle(point.ms, minTimeValue, maxTimeValue, dynamicArcSpan);
                            const x = centerX + radius * Math.cos(angle);
                            const y = centerY + radius * Math.sin(angle);
                            
                            // Recency encoding: both opacity and color desaturation
                            // Newer listens: bright accent green + high opacity
                            // Older listens: muted gray-green + low opacity
                            const { opacity, color } = getDotRecency(point.listenedAt, range);
                            
                            return (
                              <circle
                                key={pointIndex}
                                cx={x}
                                cy={y}
                                r={FIXED_DOT_RADIUS}
                                fill={color}
                                opacity={opacity}
                              />
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Ranked List */}
        <div className="w-full">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Member Rankings</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.users.map((user, index) => {
              const categoryConfig = CATEGORY_CONFIG[user.category];
              const CategoryIcon = categoryConfig.icon;
              
              return (
                <div
                  key={user.userId}
                  className={cn(
                    'flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg border transition-colors',
                    'bg-card/50 border-white/5 hover:bg-white/5',
                    'flex-wrap sm:flex-nowrap'
                  )}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-6 md:w-8 text-center">
                    <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                  </div>

                  {/* Avatar */}
                  <Avatar className="w-8 h-8 md:w-10 md:h-10 border border-white/10 flex-shrink-0">
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
                      // Mobile: icon only - more padding around icon
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
                    <p className="text-xs md:text-sm font-semibold whitespace-nowrap">{formatTime(user.medianMs)}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">median</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  );
}

