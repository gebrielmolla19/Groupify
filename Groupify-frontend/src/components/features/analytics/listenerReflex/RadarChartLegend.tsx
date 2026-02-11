import { Zap, TrendingUp, Clock, BarChart3, Activity } from 'lucide-react';

interface RadarChartLegendProps {
  className?: string;
}

const METRICS = [
  {
    key: 'speed',
    label: 'Speed',
    description: 'Faster reactions',
    icon: Zap,
  },
  {
    key: 'consistency',
    label: 'Consistency',
    description: 'More predictable',
    icon: TrendingUp,
  },
  {
    key: 'recency',
    label: 'Recency',
    description: 'Reacts to new shares',
    icon: Clock,
  },
  {
    key: 'volume',
    label: 'Volume',
    description: 'More reactions',
    icon: BarChart3,
  },
  {
    key: 'burstiness',
    label: 'Burstiness',
    description: 'Reacts in streaks',
    icon: Activity,
  },
];

export default function RadarChartLegend({ className }: RadarChartLegendProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3 bg-black/60 backdrop-blur-sm rounded-lg border border-white/5 px-4 py-3">
        {METRICS.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.key}
              className="flex items-center gap-2 group"
              title={`${metric.label}: ${metric.description}`}
            >
              <div className="flex items-center justify-center w-5 h-5 rounded bg-white/5 border border-white/10 group-hover:border-primary/30 transition-colors">
                <Icon className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-foreground leading-tight">
                  {metric.label}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {metric.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
