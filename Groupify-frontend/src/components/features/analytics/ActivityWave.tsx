import { useMemo } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Trophy } from 'lucide-react';
import { useIsMobile } from '../../ui/use-mobile';

// Format date in UTC to avoid timezone issues with daily buckets
// This ensures that 2025-12-13T00:00:00.000Z displays as "Dec 13" regardless of local timezone
const formatDateUTC = (date: Date, formatStr: string) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getUTCDate();
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    
    if (formatStr === 'MMM d') {
        return `${month} ${day}`;
    } else if (formatStr === 'MMM d, yyyy') {
        return `${month} ${day}, ${year}`;
    }
    return `${month} ${day}`;
};

interface ActivityData {
    timestamp: string;
    shares: number;
    activity: number;
}

interface ActivityWaveProps {
    data: ActivityData[];
    isLoading?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const date = new Date(payload[0].payload.ts);
        return (
            <div className="bg-background/95 border border-border p-3 rounded-lg shadow-xl backdrop-blur-md">
                <p className="text-sm font-medium text-foreground mb-1">
                    {formatDateUTC(date, 'MMM d, yyyy')}
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
    const isMobile = useIsMobile();
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

    // On mobile, aggregate into weekly buckets when there are more than 10 data points
    // so all bars fit on screen without scrolling.
    // Uses a string label key so recharts treats it as categorical — equal bar widths.
    const mobileChartData = useMemo(() => {
        const base = chartData.length <= 10 ? chartData : (() => {
            const weeks: { label: string; ts: number; activity: number; shares: number }[] = [];
            for (let i = 0; i < chartData.length; i += 7) {
                const slice = chartData.slice(i, i + 7);
                weeks.push({
                    label: formatDateUTC(new Date(slice[0].ts), 'MMM d'),
                    ts: slice[0].ts,
                    activity: slice.reduce((s, d) => s + d.activity, 0),
                    shares: slice.reduce((s, d) => s + d.shares, 0),
                });
            }
            return weeks;
        })();
        // Add label to daily data too for consistent categorical rendering
        return base.map(d => ({
            ...d,
            label: 'label' in d ? d.label : formatDateUTC(new Date(d.ts), 'MMM d'),
        }));
    }, [isMobile, chartData]);

    const mobileMaxActivity = useMemo(
        () => mobileChartData.reduce((max, d) => Math.max(max, d.activity), 0),
        [mobileChartData]
    );

    const maxActivity = useMemo(() => {
        if (!chartData?.length) return 0;
        return chartData.reduce((max, d) => Math.max(max, Number(d.activity) || 0), 0);
    }, [chartData]);

    const totalShares = useMemo(() => {
        if (!chartData?.length) return 0;
        return chartData.reduce((sum, d) => sum + (Number(d.shares) || 0), 0);
    }, [chartData]);

    const totalNoise = useMemo(() => {
        if (!chartData?.length) return 0;
        return chartData.reduce((sum, d) => sum + (Number(d.activity) || 0), 0);
    }, [chartData]);

    const peakDay = useMemo(() => {
        if (!chartData?.length) return null;
        return chartData.reduce((peak, current) => {
            return (current.activity > peak.activity) ? current : peak;
        }, chartData[0]);
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
                <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase flex items-center gap-2">
                    Group Frequency
                    {isMobile && chartData.length > 10 && (
                        <span className="normal-case text-[10px] font-normal text-muted-foreground/60 tracking-normal">· weekly view</span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 flex flex-col gap-4">
                {/* Mobile: aggregated bar chart (weekly buckets when > 10 days) — fits screen without scrolling */}
                {isMobile ? (
                    <div>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={mobileChartData} margin={{ top: 8, right: 8, bottom: 24, left: 0 }} barCategoryGap="30%">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                                    stroke="rgba(255,255,255,0.1)"
                                    interval="preserveStartEnd"
                                />
                                <YAxis hide />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <Bar dataKey="activity" radius={[3, 3, 0, 0]}>
                                    {mobileChartData.map((entry, index) => (
                                        <Cell
                                            key={index}
                                            fill={entry.activity === mobileMaxActivity ? '#00FF88' : 'rgba(0,255,136,0.45)'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                /* Desktop: area chart */
                <div className="w-full" style={{ minHeight: '200px' }}>
                    <ResponsiveContainer width="100%" height={220}>
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
                                tickFormatter={(ts) => formatDateUTC(new Date(ts), 'MMM d')}
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
                )}
                {/* Stats — horizontal row below the chart */}
                <div className="flex items-stretch border-t border-white/10 pt-4">
                    <div className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[11px] text-muted-foreground">Shares</span>
                        <span className="text-2xl font-bold">{totalShares}</span>
                    </div>
                    <div className="w-px bg-white/10 mx-2" />
                    <div className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[11px] text-muted-foreground">Noise</span>
                        <span className="text-2xl font-bold text-primary">{totalNoise}</span>
                    </div>
                    {peakDay && peakDay.activity > 0 && (
                        <>
                            <div className="w-px bg-white/10 mx-2" />
                            <div className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Trophy className="w-3 h-3 text-primary" /> Peak
                                </span>
                                <span className="text-2xl font-bold text-primary">
                                    {formatDateUTC(new Date(peakDay.ts), 'MMM d')}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </CardContent>
        </div>
    );
}
