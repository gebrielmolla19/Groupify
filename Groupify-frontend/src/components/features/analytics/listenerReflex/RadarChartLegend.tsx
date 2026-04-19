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
      <div className="legend-grid gap-x-4 gap-y-2 bg-black/60 backdrop-blur-sm rounded-lg border border-white/5 px-4 py-3">
        {METRICS.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.key} className="legend-item flex items-center gap-2 group min-w-0">
              <span className="legend-item-tooltip">{metric.description}</span>
              <div className="flex items-center justify-center w-5 h-5 rounded bg-white/5 border border-white/10 group-hover:border-primary/30 transition-colors flex-shrink-0">
                <Icon className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-[11px] font-medium text-foreground leading-tight truncate">
                {metric.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
