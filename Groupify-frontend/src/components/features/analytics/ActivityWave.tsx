import { useMemo } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { useIsMobile } from '../../ui/use-mobile';
import { activityHeadline } from '../../../lib/groupChartsCopy';
import type { AnalyticsRange } from '../../../types/analytics';

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
    mode: 'shares' | 'engagement';
    range: AnalyticsRange;
}

type ChartPoint = { ts: number; shares: number; activity: number };

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
        const point = payload[0].payload as ChartPoint;
        return (
            <div className="rounded-lg border border-hair bg-raised p-3 shadow-xl">
                <p className="text-sm font-medium text-foreground mb-1">
                    {formatDateUTC(new Date(point.ts), 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-foreground">
                    Shares, listens and likes: {point.activity}
                </p>
                <p className="text-xs text-soft">
                    Shares: {point.shares}
                </p>
            </div>
        );
    }
    return null;
};

/**
 * Resonance Frequency: the whole group's shares, listens and likes per day
 * in the page's period. Everyone's activity, so the marks are white.
 */
export default function ActivityWave({ data, mode, range }: ActivityWaveProps) {
    const isMobile = useIsMobile();

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

    const headline = activityHeadline(
        {
            shares: totalShares,
            activity: totalNoise,
            peakDay: peakDay && peakDay.activity > 0 ? formatDateUTC(new Date(peakDay.ts), 'MMM d') : null,
        },
        mode,
        range
    );

    if (!data || data.length === 0 || totalNoise === 0) {
        return <p className="text-base font-medium text-foreground">{headline}</p>;
    }

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <p className="text-base font-medium text-foreground" aria-live="polite">{headline}</p>
            {/* Phone: bars, in weekly buckets past 10 days so they fit without scrolling */}
            {isMobile ? (
                <div aria-hidden="true">
                    {chartData.length > 10 && <p className="mb-1 text-xs text-quiet">Each bar is one week</p>}
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={mobileChartData} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="30%">
                            <CartesianGrid stroke="var(--hair)" vertical={false} />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: 'var(--text-quiet)', fontSize: 10 }}
                                stroke="var(--hair)"
                                tickLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis hide />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--selected)' }} />
                            <Bar dataKey="activity" radius={[4, 4, 0, 0]} maxBarSize={24}>
                                {mobileChartData.map((entry) => (
                                    <Cell
                                        key={entry.ts}
                                        fill={entry.activity === mobileMaxActivity ? 'var(--text)' : 'var(--text-quiet)'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                /* Desktop: area chart */
                <div aria-hidden="true">
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                            <CartesianGrid stroke="var(--hair)" vertical={false} />
                            <XAxis
                                dataKey="ts"
                                type="number"
                                scale="time"
                                domain={['dataMin', 'dataMax']}
                                tick={{ fill: 'var(--text-quiet)', fontSize: 11 }}
                                tickFormatter={(ts) => formatDateUTC(new Date(ts), 'MMM d')}
                                stroke="var(--hair)"
                                tickLine={false}
                                tickCount={6}
                                minTickGap={50}
                            />
                            <YAxis
                                domain={[0, Math.max(5, maxActivity + 2)]}
                                allowDecimals={false}
                                tick={{ fill: 'var(--text-quiet)', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                                width={30}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--line)', strokeWidth: 1 }} />
                            <Area
                                type="monotone"
                                dataKey="activity"
                                stroke="var(--text)"
                                fill="var(--text)"
                                fillOpacity={0.1}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 5, fill: 'var(--text)', stroke: 'var(--raised)', strokeWidth: 2 }}
                                animationDuration={1200}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
            {/* The chart's numbers for screen readers */}
            <div className="sr-only">
                <table>
                    <caption>Shares, listens and likes per day</caption>
                    <thead>
                        <tr><th scope="col">Day</th><th scope="col">Shares, listens and likes</th><th scope="col">Shares</th></tr>
                    </thead>
                    <tbody>
                        {chartData.map((d) => (
                            <tr key={d.ts}>
                                <th scope="row">{formatDateUTC(new Date(d.ts), 'MMM d, yyyy')}</th>
                                <td>{d.activity}</td>
                                <td>{d.shares}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <dl className="grid grid-cols-3 gap-2 border-t border-hair pt-4">
                <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-soft">Shares</dt>
                    <dd className="mt-auto font-display text-2xl font-semibold text-foreground">{totalShares}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-soft">Shares, listens and likes</dt>
                    <dd className="mt-auto font-display text-2xl font-semibold text-foreground">{totalNoise}</dd>
                </div>
                {peakDay && peakDay.activity > 0 && (
                    <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-soft">Busiest day</dt>
                        <dd className="mt-auto font-display text-2xl font-semibold text-foreground">
                            {formatDateUTC(new Date(peakDay.ts), 'MMM d')}
                        </dd>
                    </div>
                )}
            </dl>
        </div>
    );
}
