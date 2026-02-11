import { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { RadarProfile } from '../../../../types';

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
  return ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const axis = AXIS_CONFIG.find(a => a.label === label);
    if (!axis) return null;

    return (
      <div className="bg-background/95 border border-border p-3 rounded-lg shadow-xl backdrop-blur-md min-w-[200px]">
        <p className="text-sm font-semibold text-foreground mb-2 border-b border-border pb-1">
          {label}
        </p>
        {payload.map((item: any, index: number) => {
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
    
    console.log('RadarChart: Generated chartData', {
      chartData: result,
      selectedMemberIds,
      profiles: profiles.map(p => ({ userId: p.userId, displayName: p.displayName }))
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
            outerRadius="60%" 
            data={chartData}
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          >
          <PolarGrid 
            stroke="rgba(255,255,255,0.3)" 
            strokeWidth={1.5}
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#FFFFFF', fontSize: 13, fontWeight: 600 }}
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
