import { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { RadarProfile } from '../../../../types';

// SVG path data for each axis icon (Lucide 24×24 viewBox, stroke-based)
const AXIS_ICON_PATHS: Record<string, React.ReactNode> = {
  Speed: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  Consistency: (
    <>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </>
  ),
  Recency: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  Volume: (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  Burstiness: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
};

const ICON_SIZE = 20;

const ICON_GAP = 14; // extra px to push icon away from the graph edge

interface CustomTickProps {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  payload?: { value: string };
}

function CustomAxisTick({ x = 0, y = 0, cx = 0, cy = 0, payload }: CustomTickProps) {
  if (!payload?.value) return null;
  const paths = AXIS_ICON_PATHS[payload.value];
  if (!paths) return null;

  // Push the icon outward along the axis vector
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ox = x + (dx / dist) * ICON_GAP;
  const oy = y + (dy / dist) * ICON_GAP;

  return (
    <g transform={`translate(${ox - ICON_SIZE / 2}, ${oy - ICON_SIZE / 2})`}>
      <title>{payload.value}</title>
      <svg
        width={ICON_SIZE}
        height={ICON_SIZE}
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths}
      </svg>
    </g>
  );
}

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

interface RadarChartProps {
  profiles: RadarProfile[];
  selectedMemberIds: string[];
  showGroupMedian?: boolean;
  groupMedianProfile?: RadarProfile | null;
}

const AXIS_CONFIG = [
  { key: 'speed', label: 'Speed', description: 'Reaction speed' },
  { key: 'consistency', label: 'Consistency', description: 'Predictability' },
  { key: 'recency', label: 'Recency', description: 'Reacts to new shares' },
  { key: 'volume', label: 'Volume', description: 'Engagement volume' },
  { key: 'burstiness', label: 'Burstiness', description: 'Reacts in streaks' },
];

// Color scheme: cyan, violet, blue variants (not green)
export const RADAR_CHART_COLORS = [
  '#00D9FF', // Cyan
  '#A855F7', // Violet
  '#3B82F6', // Blue
];

// Legacy alias for backward compatibility
const COLORS = RADAR_CHART_COLORS;

// Create custom tooltip component
const createCustomTooltip = (profiles: RadarProfile[]) => {
  return ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload || !payload.length) return null;

    const axis = AXIS_CONFIG.find(a => a.label === label);
    if (!axis) return null;

    return (
      <div className="bg-background/95 border border-border p-3 rounded-lg shadow-xl backdrop-blur-md min-w-[200px]">
        <p className="text-sm font-semibold text-foreground mb-2 border-b border-border pb-1">
          {label}
        </p>
        {payload.map((item: TooltipPayloadItem, index: number) => {
          const memberId = item.dataKey;
          const value = item.value;
          const profile = profiles.find(p => String(p.userId) === String(memberId));
          
          if (!profile) return null;

          const color = item.dataKey === 'groupMedian' 
            ? '#9CA3AF' // Gray for group median
            : RADAR_CHART_COLORS[index % RADAR_CHART_COLORS.length];

          return (
            <div key={memberId} className="mb-2 last:mb-0">
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-medium" style={{ color }}>
                  {profile.displayName}
                </span>
                {profile.lowData && (
                  <span className="text-xs text-muted-foreground">(Low data)</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground ml-4">
                <div>Score: {value}/100</div>
                {axis.key === 'speed' && (
                  <div>Median: {Math.round(profile.raw.medianLatencySeconds / 60)} min</div>
                )}
                {axis.key === 'consistency' && (
                  <div>IQR: {Math.round(profile.raw.iqrSeconds / 60)} min</div>
                )}
                {axis.key === 'volume' && (
                  <div>Reactions: {profile.raw.reactionCount}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
};

export default function ListenerReflexRadarChart({ 
  profiles, 
  selectedMemberIds,
  showGroupMedian = false,
  groupMedianProfile = null
}: RadarChartProps) {
  const chartData = useMemo(() => {
    if (!profiles || profiles.length === 0 || selectedMemberIds.length === 0) {
      return [];
    }

    const result = AXIS_CONFIG.map(axis => {
      const point: any = { subject: axis.label, fullMark: 100 };

      selectedMemberIds.forEach(memberId => {
        // Ensure string comparison for userId matching
        const profile = profiles.find(p => String(p.userId) === String(memberId));
        if (profile) {
          const axisValue = profile.axes[axis.key as keyof typeof profile.axes];
          point[String(memberId)] = axisValue !== undefined && axisValue !== null ? axisValue : 0;
        }
      });

      // Add group median if enabled
      if (showGroupMedian && groupMedianProfile) {
        point.groupMedian = groupMedianProfile.axes[axis.key as keyof typeof groupMedianProfile.axes];
      }

      return point;
    });
    
    return result;
  }, [profiles, selectedMemberIds, showGroupMedian, groupMedianProfile]);

  const CustomTooltip = useMemo(() => {
    if (!profiles || profiles.length === 0) return () => null;
    return createCustomTooltip(profiles);
  }, [profiles]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground border border-dashed border-white/20 rounded-lg">
        <div className="text-center">
          <p className="text-sm">Select members to compare</p>
          <p className="text-xs text-muted-foreground mt-2">
            Profiles: {profiles?.length || 0}, Selected: {selectedMemberIds.length}
          </p>
        </div>
      </div>
    );
  }

  // Ensure chartData has valid values
  const hasValidData = chartData.some(point => 
    selectedMemberIds.some(id => {
      const key = String(id);
      return point[key] !== undefined && point[key] !== null;
    })
  );

  if (!hasValidData) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground border border-dashed border-white/20 rounded-lg">
        <div className="text-center">
          <p className="text-sm">No valid data to display</p>
          <p className="text-xs text-muted-foreground mt-2">
            Check console for details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full min-h-[400px] rounded-lg relative bg-black/20 border border-white/5 transition-opacity duration-300">
      <div style={{ width: '100%', height: '400px', position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            cx="50%"
            cy="50%"
            outerRadius="58%"
            data={chartData}
            margin={{ top: 36, right: 56, bottom: 36, left: 56 }}
          >
          <PolarGrid
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1.5}
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={<CustomAxisTick />}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.3)' }}
          />
          {selectedMemberIds.map((memberId, index) => {
            const profile = profiles.find(p => String(p.userId) === String(memberId));
            if (!profile) {
              console.warn('RadarChart: Profile not found', { memberId, availableIds: profiles.map(p => p.userId) });
              return null;
            }

            const color = RADAR_CHART_COLORS[index % RADAR_CHART_COLORS.length];
            const opacity = profile.lowData ? 0.3 : 0.15;
            const dataKey = String(memberId);

            return (
              <Radar
                key={dataKey}
                name={profile.displayName}
                dataKey={dataKey}
                stroke={color}
                fill={color}
                fillOpacity={opacity}
                strokeWidth={2}
                dot={{ 
                  fill: color, 
                  stroke: color,
                  strokeWidth: 2,
                  r: 4
                }}
              />
            );
          })}
          {showGroupMedian && groupMedianProfile && (
            <Radar
              name="Group Median"
              dataKey="groupMedian"
              stroke="#9CA3AF"
              fill="#9CA3AF"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
