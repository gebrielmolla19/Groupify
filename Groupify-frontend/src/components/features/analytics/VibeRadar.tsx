import { useState, useMemo, useEffect } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardTitle, CardDescription } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { cn } from '../../ui/utils';

interface VibeStats {
    activity: number;
    popularity: number;
    support: number;
    variety: number;
    freshness: number;
}

interface MemberVibe {
    userId: string;
    displayName: string;
    profileImage: string | null;
    stats: VibeStats;
    raw: any;
}

interface VibeRadarProps {
    data: MemberVibe[];
    isLoading?: boolean;
}

const AXIS_CONFIG = [
    { key: 'activity', label: 'Activity', description: 'Volume of shares' },
    { key: 'popularity', label: 'Popularity', description: 'Avg likes received' },
    { key: 'support', label: 'Support', description: 'Likes given' },
    { key: 'variety', label: 'Variety', description: 'Unique artists' },
    { key: 'freshness', label: 'Freshness', description: 'Recent activity' },
];

const COLORS = [
    '#00FF88', // Bright primary green (matches app accent)
    '#3B82F6', // Bright blue
    '#F59E0B', // Bright amber/orange
];

export default function VibeRadar({ data, isLoading }: VibeRadarProps) {
    // Default to showing top 2 members
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Initialize selection once data loads
    useEffect(() => {
        if (data && data.length > 0 && selectedIds.length === 0) {
            setSelectedIds(data.slice(0, 2).map(d => String(d.userId)));
        }
    }, [data, selectedIds.length]);

    const toggleMember = (userId: string) => {
        const id = String(userId); // Ensure string comparison
        
        console.log('Toggle member clicked:', { 
            userId: id, 
            currentSelected: selectedIds,
            isCurrentlySelected: selectedIds.includes(id),
            currentCount: selectedIds.length 
        });
        
        if (selectedIds.includes(id)) {
            // Don't allow unselecting the last one
            if (selectedIds.length > 1) {
                const newSelection = selectedIds.filter(sid => sid !== id);
                console.log('Deselecting, new selection:', newSelection);
                setSelectedIds(newSelection);
            } else {
                console.log('Cannot deselect - last member');
            }
        } else {
            // Limit to 3 for readability
            if (selectedIds.length < 3) {
                const newSelection = [...selectedIds, id];
                console.log('Adding member, new selection:', newSelection);
                setSelectedIds(newSelection);
            } else {
                // Shift first out
                const newSelection = [...selectedIds.slice(1), id];
                console.log('Max reached, replacing first, new selection:', newSelection);
                setSelectedIds(newSelection);
            }
        }
    };

    const chartData = useMemo(() => {
        if (!data || !data.length || !selectedIds.length) {
            console.log('VibeRadar: No data or selected IDs', { data: data?.length, selectedIds: selectedIds.length });
            return [];
        }
        
        const result = AXIS_CONFIG.map(axis => {
            const point: any = { subject: axis.label, fullMark: 100 };
            
            selectedIds.forEach(selectedId => {
                const member = data.find(m => String(m.userId) === String(selectedId));
                if (member) {
                    point[String(selectedId)] = member.stats[axis.key as keyof VibeStats];
                }
            });
            
            return point;
        });
        
        return result;
    }, [data, selectedIds]);

    if (isLoading) {
        return (
            <Card className="w-full bg-card/50 backdrop-blur-sm border-white/5 h-[500px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-muted-foreground animate-pulse">Scanning vibes...</p>
                </div>
            </Card>
        );
    }

    if (!data || data.length === 0) {
        return (
            <Card className="w-full bg-card/50 backdrop-blur-sm border-white/5 h-[500px] flex items-center justify-center">
                <p className="text-muted-foreground">No data available yet.</p>
            </Card>
        );
    }

    return (
        <Card className="w-full bg-card/50 backdrop-blur-sm border-white/5 overflow-hidden flex flex-col lg:flex-row h-auto lg:h-[500px]">
            {/* Controls / Legend */}
            <div className="p-6 lg:w-1/3 flex flex-col border-b lg:border-b-0 lg:border-r border-white/5 gap-4 overflow-y-auto">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <span className="text-2xl">📡</span> Vibe Radar
                    </CardTitle>
                    <CardDescription className="mt-1">
                        Compare member personalities across 5 dimensions.
                    </CardDescription>
                </div>

                <div className="space-y-3 mt-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                            Select Members (Max 3)
                        </p>
                        <p className="text-xs text-primary font-semibold">
                            {selectedIds.length} Selected
                        </p>
                    </div>
                    {data.map((member, index) => {
                        const memberId = String(member.userId);
                        const isSelected = selectedIds.includes(memberId);
                        const selectionIndex = selectedIds.indexOf(memberId);
                        const color = selectionIndex >= 0 ? COLORS[selectionIndex % COLORS.length] : undefined;

                        return (
                            <div
                                key={memberId}
                                onClick={() => toggleMember(memberId)}
                                className={cn(
                                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200 border-2",
                                    isSelected
                                        ? "bg-white/10 shadow-lg scale-[1.02]"
                                        : "hover:bg-white/5 border-transparent opacity-60 hover:opacity-100"
                                )}
                                style={isSelected ? { 
                                    borderColor: color,
                                    boxShadow: `0 0 20px ${color}40`
                                } : {}}
                            >
                                <Avatar className="w-10 h-10 border border-white/10">
                                    <AvatarImage src={member.profileImage || undefined} />
                                    <AvatarFallback>{member.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate" style={isSelected ? { color } : {}}>
                                        {member.displayName}
                                    </p>
                                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                                        <span>Act: {member.stats.activity}</span>
                                        <span>Pop: {member.stats.popularity}</span>
                                    </div>
                                </div>
                                {isSelected && (
                                    <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ 
                                            backgroundColor: color,
                                            boxShadow: `0 0 12px ${color}`
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 p-4 flex flex-col relative min-h-[400px]">
                {/* Color Legend */}
                {selectedIds.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-3">
                        {selectedIds.map((id, index) => {
                            const member = data.find(m => String(m.userId) === id);
                            const color = COLORS[index % COLORS.length];
                            return (
                                <div key={id} className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full">
                                    <div 
                                        className="w-3 h-3 rounded-full" 
                                        style={{ 
                                            backgroundColor: color,
                                            boxShadow: `0 0 8px ${color}`
                                        }} 
                                    />
                                    <span className="text-sm font-medium" style={{ color }}>
                                        {member?.displayName || 'Unknown'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {chartData.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-muted-foreground">Select members to compare</p>
                    </div>
                ) : (
                    <div className="flex-1 w-full min-h-[400px] rounded-lg relative bg-black/20 border border-white/5">
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
                        {selectedIds.map((id, index) => {
                            const member = data.find(m => String(m.userId) === id);
                            const color = COLORS[index % COLORS.length];
                            return (
                                <Radar
                                    key={id}
                                    name={member?.displayName || 'Unknown'}
                                    dataKey={id}
                                    stroke={color}
                                    fill={color}
                                    fillOpacity={0.25}
                                    strokeWidth={4}
                                    dot={{ 
                                        fill: color, 
                                        stroke: color,
                                        strokeWidth: 2,
                                        r: 5
                                    }}
                                />
                            );
                        })}
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(0,0,0,0.8)',
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            backdropFilter: 'blur(8px)',
                                            color: '#fff'
                                        }}
                                        itemStyle={{ fontSize: 12 }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Axis Explainer */}
                <div className="absolute top-4 right-4 hidden md:block">
                    <TooltipProviderWrapper />
                </div>
            </div>
        </Card>
    );
}

// Helper to keep main component clean
function TooltipProviderWrapper() {
    return null; // Implemented simplified version first
}
