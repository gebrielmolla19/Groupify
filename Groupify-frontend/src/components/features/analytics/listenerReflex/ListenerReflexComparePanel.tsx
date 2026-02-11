import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../../ui/avatar';
import { Checkbox } from '../../../ui/checkbox';
import { Input } from '../../../ui/input';
import { Skeleton } from '../../../ui/skeleton';
import { Search, Users, AlertCircle } from 'lucide-react';
import { useListenerReflexRadar, type ListenerReflexRadarWindow, type ListenerReflexRadarMode } from '../../../../hooks/useListenerReflexRadar';
import type { RadarProfile } from '../../../../types';
import ListenerReflexRadarChart, { RADAR_CHART_COLORS } from './RadarChart';
import RadarChartLegend from './RadarChartLegend';
import { cn } from '../../../ui/utils';

interface ListenerReflexComparePanelProps {
  groupId: string;
  window: ListenerReflexRadarWindow;
  mode: ListenerReflexRadarMode;
}

export default function ListenerReflexComparePanel({
  groupId,
  window,
  mode
}: ListenerReflexComparePanelProps) {
  const { data, isLoading, error } = useListenerReflexRadar(groupId, window, mode);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGroupMedian, setShowGroupMedian] = useState(false);
  
  // Debug: Log data to help diagnose
  useEffect(() => {
    if (data) {
      console.log('ListenerReflexComparePanel: Data loaded', {
        membersCount: data.members?.length,
        members: data.members?.map(m => ({ userId: m.userId, displayName: m.displayName, axes: m.axes })),
        selectedMemberIds,
        window,
        mode
      });
    }
  }, [data, selectedMemberIds, window, mode]);

  // Initialize selection with first 2 members when data loads
  useEffect(() => {
    if (data && data.members && data.members.length > 0 && selectedMemberIds.length === 0) {
      const initialIds = data.members.slice(0, Math.min(2, data.members.length)).map(m => String(m.userId));
      setSelectedMemberIds(initialIds);
    }
  }, [data, selectedMemberIds.length]);

  // Filter members by search query
  const filteredMembers = useMemo(() => {
    if (!data || !data.members) return [];
    if (!searchQuery.trim()) return data.members;
    
    const query = searchQuery.toLowerCase();
    return data.members.filter(member =>
      member.displayName.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  // Toggle member selection (max 3)
  const toggleMember = (userId: string) => {
    const userIdStr = String(userId);
    setSelectedMemberIds(prev => {
      const prevStr = prev.map(id => String(id));
      if (prevStr.includes(userIdStr)) {
        // Allow unselecting if more than 1 selected
        if (prevStr.length > 1) {
          return prevStr.filter(id => id !== userIdStr);
        }
        return prevStr;
      } else {
        // Add if under limit
        if (prevStr.length < 3) {
          return [...prevStr, userIdStr];
        }
        // Replace first if at limit
        return [...prevStr.slice(1), userIdStr];
      }
    });
  };

  // Calculate group median profile
  const groupMedianProfile = useMemo(() => {
    if (!data || !data.members || data.members.length === 0) return null;

    const axes = ['speed', 'consistency', 'recency', 'volume', 'burstiness'] as const;
    const medianAxes: Record<string, number> = {};

    axes.forEach(axis => {
      const values = data.members
        .map(m => m.axes[axis])
        .filter(v => !isNaN(v))
        .sort((a, b) => a - b);
      
      if (values.length === 0) {
        medianAxes[axis] = 0;
        return;
      }

      const mid = Math.floor(values.length / 2);
      medianAxes[axis] = values.length % 2 === 0
        ? (values[mid - 1] + values[mid]) / 2
        : values[mid];
    });

    return {
      userId: 'groupMedian',
      displayName: 'Group Median',
      avatarUrl: null,
      axes: {
        speed: Math.round(medianAxes.speed),
        consistency: Math.round(medianAxes.consistency),
        recency: Math.round(medianAxes.recency),
        volume: Math.round(medianAxes.volume),
        burstiness: Math.round(medianAxes.burstiness)
      },
      raw: {
        reactionCount: 0,
        medianLatencySeconds: 0,
        iqrSeconds: 0
      },
      lowData: false
    } as RadarProfile;
  }, [data]);

  // Get selected profiles
  const selectedProfiles = useMemo(() => {
    if (!data || !data.members) return [];
    return data.members.filter(m => 
      selectedMemberIds.some(id => String(id) === String(m.userId))
    );
  }, [data, selectedMemberIds]);

  // Get color for a member based on their index in selectedMemberIds
  const getMemberColor = (userId: string): string | undefined => {
    const index = selectedMemberIds.findIndex(id => String(id) === String(userId));
    if (index === -1) return undefined;
    return RADAR_CHART_COLORS[index % RADAR_CHART_COLORS.length];
  };

  // Convert hex color to rgba with opacity
  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  if (isLoading) {
    return (
      <Card className="bg-black/40 border-white/5">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-black/40 border-white/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.members || data.members.length === 0) {
    return (
      <Card className="bg-black/40 border-white/5">
        <CardContent className="p-6">
          <p className="text-muted-foreground text-sm">No member data available for comparison.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/40 border-white/5">
      <CardHeader>
        <CardTitle className="text-lg">Compare Members</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Member Picker */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Select Members (max 3)</label>
            {selectedMemberIds.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedMemberIds.length} Selected
              </Badge>
            )}
          </div>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Member List */}
          <div className="max-h-48 overflow-y-auto space-y-2 border border-white/5 rounded-lg p-2">
            {filteredMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No members found
              </p>
            ) : (
              filteredMembers.map(member => {
                const memberIdStr = String(member.userId);
                const isSelected = selectedMemberIds.some(id => String(id) === memberIdStr);
                const isDisabled = !isSelected && selectedMemberIds.length >= 3;
                const memberColor = isSelected ? getMemberColor(memberIdStr) : undefined;

                return (
                  <div
                    key={member.userId}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border",
                      isSelected && memberColor && "border-opacity-30",
                      !isSelected && !isDisabled && "hover:bg-white/5 border-transparent",
                      isDisabled && "opacity-50 cursor-not-allowed border-transparent"
                    )}
                    style={
                      isSelected && memberColor
                        ? {
                            backgroundColor: hexToRgba(memberColor, 0.15),
                            borderColor: hexToRgba(memberColor, 0.5),
                          }
                        : undefined
                    }
                    onClick={() => !isDisabled && toggleMember(memberIdStr)}
                  >
                    <div className="relative flex-shrink-0">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => !isDisabled && toggleMember(memberIdStr)}
                        disabled={isDisabled}
                        className={cn(
                          isSelected && memberColor && "border-opacity-60",
                        )}
                        style={
                          isSelected && memberColor
                            ? {
                                borderColor: memberColor,
                              }
                            : undefined
                        }
                      />
                      {isSelected && memberColor && (
                        <div
                          className="absolute -inset-0.5 rounded-[4px] pointer-events-none"
                          style={{
                            backgroundColor: hexToRgba(memberColor, 0.2),
                            border: `1px solid ${hexToRgba(memberColor, 0.4)}`,
                          }}
                        />
                      )}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatarUrl || undefined} />
                      <AvatarFallback
                        style={
                          isSelected && memberColor
                            ? {
                                backgroundColor: hexToRgba(memberColor, 0.2),
                                borderColor: hexToRgba(memberColor, 0.6),
                              }
                            : undefined
                        }
                        className={isSelected && memberColor ? 'border-2' : ''}
                      >
                        {member.displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={isSelected && memberColor ? { color: memberColor } : undefined}
                      >
                        {member.displayName}
                      </p>
                      {member.lowData && (
                        <p className="text-xs text-muted-foreground">Not enough data</p>
                      )}
                    </div>
                    {member.lowData && (
                      <Badge variant="outline" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Low Data
                      </Badge>
                    )}
                    {isSelected && memberColor && (
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: memberColor }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Radar Chart */}
        {selectedMemberIds.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Radar Comparison</h3>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="groupMedian"
                  checked={showGroupMedian}
                  onCheckedChange={(checked) => setShowGroupMedian(checked === true)}
                />
                <label
                  htmlFor="groupMedian"
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Compare against group median
                </label>
              </div>
            </div>
            
            <div className="w-full">
              <ListenerReflexRadarChart
                profiles={data.members}
                selectedMemberIds={selectedMemberIds}
                showGroupMedian={showGroupMedian}
                groupMedianProfile={groupMedianProfile}
              />
            </div>

            {/* Legend */}
            <RadarChartLegend />
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center space-y-2">
              <Users className="h-8 w-8 mx-auto opacity-50" />
              <p className="text-sm">Select members above to compare</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
