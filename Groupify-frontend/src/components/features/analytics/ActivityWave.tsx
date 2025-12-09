import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { format } from 'date-fns';

interface ActivityData {
    timestamp: string;
    shares: number;
    activity: number;
}

interface ActivityWaveProps {
    data: ActivityData[];
    isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background/90 border border-border p-3 rounded-lg shadow-xl backdrop-blur-md">
                <p className="text-sm font-medium text-foreground mb-1">
                    {format(new Date(label), 'MMM d, h:mm a')}
                </p>
                <p className="text-xs text-primary">
                    Activity Score: {payload[0].value}
                </p>
                <p className="text-xs text-muted-foreground">
                    Shares: {payload[0].payload.shares}
                </p>
            </div>
        );
    }
    return null;
};

export default function ActivityWave({ data, isLoading }: ActivityWaveProps) {
    // Memoize gradient ID to avoid conflicts if multiple charts exist
    const gradientId = useMemo(() => `wave-gradient-${Math.random().toString(36).substr(2, 9)}`, []);

    if (isLoading) {
        return (
            <Card className="w-full bg-card/50 backdrop-blur-sm border-white/5">
                <CardHeader>
                    <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                        Group Frequency
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-[200px] flex items-center justify-center">
                    <div className="w-full h-full animate-pulse bg-primary/5 rounded-md" />
                </CardContent>
            </Card>
        );
    }

    if (!data || data.length === 0) {
        return (
            <Card className="w-full bg-card/50 backdrop-blur-sm border-white/5">
                <CardHeader>
                    <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                        Group Frequency
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
                    No activity recorded yet. Start the wave!
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full bg-card/50 backdrop-blur-sm border-white/5 overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                    Group Frequency
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="h-[200px] w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                            <Area
                                type="monotone"
                                dataKey="activity"
                                stroke="hsl(var(--primary))"
                                fill={`url(#${gradientId})`}
                                strokeWidth={2}
                                animationDuration={1500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
