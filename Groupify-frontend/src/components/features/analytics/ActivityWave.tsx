import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CardContent, CardHeader, CardTitle } from '../../ui/card';
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
        const date = new Date(Number(label));
        return (
            <div className="bg-background/95 border border-border p-3 rounded-lg shadow-xl backdrop-blur-md">
                <p className="text-sm font-medium text-foreground mb-1">
                    {format(date, 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-primary font-semibold">
                    Activity: {payload[0].value}
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
    const gradientId = useMemo(() => `wave-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
    
    const chartData = useMemo(() => {
        if (!Array.isArray(data)) return [];
        return data.map((d) => ({
            ...d,
            ts: new Date(d.timestamp).getTime(),
            activity: Number(d.activity) || 0,
            shares: Number(d.shares) || 0,
        }));
    }, [data]);
    
    const maxActivity = useMemo(() => {
        if (!chartData?.length) return 0;
        return chartData.reduce((max, d) => Math.max(max, Number(d.activity) || 0), 0);
    }, [chartData]);

    if (isLoading) {
        return (
            <div className="w-full flex-1 flex flex-col">
                <CardHeader>
                    <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                        Group Frequency
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-center">
                    <div className="w-full h-full animate-pulse bg-primary/5 rounded-md" />
                </CardContent>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="w-full flex-1 flex flex-col">
                <CardHeader>
                    <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                        Group Frequency
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
                    No activity recorded yet. Start the wave!
                </CardContent>
            </div>
        );
    }

    return (
        <div className="w-full flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2 shrink-0">
                <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                    Group Frequency
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4" style={{ minHeight: '250px' }}>
                <div className="w-full h-full" style={{ minHeight: '200px' }}>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00FF88" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#00FF88" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid 
                                strokeDasharray="3 3" 
                                stroke="rgba(255,255,255,0.08)" 
                                vertical={false} 
                            />
                            <XAxis
                                dataKey="ts"
                                type="number"
                                scale="time"
                                domain={['dataMin', 'dataMax']}
                                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                                tickFormatter={(ts) => format(new Date(ts), 'MMM d')}
                                stroke="rgba(255,255,255,0.15)"
                                axisLine={{ strokeWidth: 1 }}
                                tickCount={6}
                                minTickGap={50}
                            />
                            <YAxis
                                domain={[0, Math.max(5, maxActivity + 2)]}
                                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                                stroke="rgba(255,255,255,0.15)"
                                axisLine={{ strokeWidth: 1 }}
                                width={30}
                            />
                            <Tooltip 
                                content={<CustomTooltip />} 
                                cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1 }} 
                            />
                            <Area
                                type="monotone"
                                dataKey="activity"
                                stroke="#00FF88"
                                fill={`url(#${gradientId})`}
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ 
                                    r: 5, 
                                    fill: '#00FF88', 
                                    stroke: '#FFFFFF', 
                                    strokeWidth: 2 
                                }}
                                animationDuration={1200}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </div>
    );
}
