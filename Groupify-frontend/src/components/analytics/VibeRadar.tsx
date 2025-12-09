import { useState, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

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
    'hsl(var(--primary))',
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#8b5cf6', // violet-500
    '#f59e0b', // amber-500
];

export default function VibeRadar({ data, isLoading }: VibeRadarProps) {
    // Default to showing top 2 members
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Initialize selection once data loads
    useMemo(() => {
        if (data && data.length > 0 && selectedIds.length === 0) {
            setSelectedIds(data.slice(0, 2).map(d => d.userId));
        }
    }, [data]);

    const toggleMember = (id: string) => {
        if (selectedIds.includes(id)) {
            // Don't allow unselecting the last one
            if (selectedIds.length > 1) {
                setSelectedIds(selectedIds.filter(sid => sid !== id));
            }
        } else {
            // Limit to 3 for readability
            if (selectedIds.length < 3) {
                setSelectedIds([...selectedIds, id]);
            } else {
                // Shift first out
                setSelectedIds([...selectedIds.slice(1), id]);
            }
        }
    };

    const chartData = useMemo(() => {
        if (!data) return [];
        return AXIS_CONFIG.map(axis => {
            const point: any = { subject: axis.label, fullMark: 100 };
            data.forEach(member => {
                if (selectedIds.includes(member.userId)) {
                    point[member.userId] = member.stats[axis.key as keyof VibeStats];
                }
            });
            return point;
        });
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
                    <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                        Select Members (Max 3)
                    </p>
                    {data.map((member, index) => {
                        const isSelected = selectedIds.includes(member.userId);
                        const selectionIndex = selectedIds.indexOf(member.userId);
                        const color = selectionIndex >= 0 ? COLORS[selectionIndex] : undefined;

                        return (
                            <div
                                key={member.userId}
                                onClick={() => toggleMember(member.userId)}
                                className={cn(
                                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200 border",
                                    isSelected
                                        ? "bg-white/5 border-white/10 shadow-sm"
                                        : "hover:bg-white/5 border-transparent opacity-60 hover:opacity-100"
                                )}
                                style={isSelected ? { borderColor: color } : {}}
                            >
                                <Avatar className="w-10 h-10 border border-white/10">
                                    <AvatarImage src={member.profileImage || undefined} />
                                    <AvatarFallback>{member.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{member.displayName}</p>
                                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                                        <span>Act: {member.stats.activity}</span>
                                        <span>Pop: {member.stats.popularity}</span>
                                    </div>
                                </div>
                                {isSelected && (
                                    <div
                                        className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]"
                                        style={{ backgroundColor: color, color: color }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 p-4 flex flex-col relative min-h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                        <PolarGrid stroke="rgba(255,255,255,0.1)" />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                        />
                        <PolarRadiusAxis
                            angle={30}
                            domain={[0, 100]}
                            tick={false}
                            axisLine={false}
                        />
                        {selectedIds.map((id, index) => (
                            <Radar
                                key={id}
                                name={data.find(m => m.userId === id)?.displayName || 'Unknown'}
                                dataKey={id}
                                stroke={COLORS[index]}
                                fill={COLORS[index]}
                                fillOpacity={0.2}
                            />
                        ))}
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
