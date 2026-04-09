import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Globe, Sparkles, Zap, Wrench, ChevronUp, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "../../ui/sidebar";
import { Button } from "../../ui/button";
import { Separator } from "../../ui/separator";
import { changelog, categoryLabels } from "../../../data/changelog";
import type { ChangelogCategory, ChangelogItem } from "../../../data/changelog";
import { useChangelogStatus } from "../../../hooks/useChangelogStatus";

type FilterType = "all" | ChangelogCategory;

const filters: { value: FilterType; label: string; icon: typeof Globe }[] = [
  { value: "all", label: "ALL", icon: Globe },
  { value: "new", label: "NEW RELEASES", icon: Sparkles },
  { value: "improvement", label: "IMPROVEMENTS", icon: Zap },
  { value: "fix", label: "FIXES", icon: Wrench },
];

const categoryColors: Record<ChangelogCategory, { color: string; bg: string }> = {
  new: { color: "#86efac", bg: "rgba(134,239,172,0.1)" },           // green-300
  improvement: { color: "#93c5fd", bg: "rgba(147,197,253,0.1)" },   // blue-300
  fix: { color: "#fdba74", bg: "rgba(253,186,116,0.1)" },           // orange-300
};

const filterColors: Record<FilterType, string> = {
  all: "rgba(255,255,255,0.9)",
  new: "#86efac",
  improvement: "#93c5fd",
  fix: "#fdba74",
};

function formatItemDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = String(d.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

function groupByMonth(items: ChangelogItem[]): { month: string; items: ChangelogItem[] }[] {
  const grouped = new Map<string, ChangelogItem[]>();
  for (const item of items) {
    const d = new Date(item.date + "T00:00:00");
    const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  return Array.from(grouped.entries()).map(([month, items]) => ({ month, items }));
}

export default function ChangelogScreen() {
  const navigate = useNavigate();
  const { markAsRead } = useChangelogStatus();
  const [filter, setFilter] = useState<FilterType>("all");
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  const filtered = useMemo(() => {
    if (filter === "all") return changelog;
    return changelog.filter((item) => item.category === filter);
  }, [filter]);

  const months = useMemo(() => groupByMonth(filtered), [filtered]);

  const toggleMonth = (month: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 md:h-16 items-center gap-2 md:gap-4 px-4 md:px-6">
          <SidebarTrigger />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-semibold tracking-tight">What's New</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 pb-16" style={{ paddingTop: '2.5rem' }}>
        {/* Title */}
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ marginBottom: '2.5rem' }}>
          Changelog
        </h2>

        <Separator style={{ marginBottom: '1.5rem' }} />

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto" style={{ marginBottom: '2.5rem', paddingBottom: '1rem' }}>
          {filters.map((f) => {
            const Icon = f.icon;
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className="flex items-center gap-1.5 whitespace-nowrap transition-colors shrink-0"
                style={{
                  padding: '0.5rem 0.875rem',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0.1em',
                  color: active ? filterColors[f.value] : 'rgba(255,255,255,0.35)',
                  backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: active ? filterColors[f.value] : undefined }} />
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Entries grouped by month */}
        {months.map(({ month, items }, monthIdx) => {
          const collapsed = collapsedMonths.has(month);
          return (
            <div key={month} style={{ marginBottom: '2.5rem' }}>
              {monthIdx > 0 && <Separator className="opacity-30" style={{ marginBottom: '2.5rem' }} />}
              {/* Month Header */}
              <button
                onClick={() => toggleMonth(month)}
                className="flex items-center cursor-pointer group"
                style={{ gap: '0.625rem', marginBottom: '1.5rem' }}
              >
                <h3 className="text-xl md:text-2xl font-bold tracking-tight">{month}</h3>
                {collapsed ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {!collapsed && (
                <div>
                  {items.map((item, i) => (
                    <div key={`${item.date}-${i}`}>
                      <div style={{ padding: '1.25rem 0' }}>
                        {/* Date + Badge row */}
                        <div className="flex items-center" style={{ gap: '0.75rem', marginBottom: '0.375rem' }}>
                          <span
                            className="font-mono"
                            style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}
                          >
                            {formatItemDate(item.date)}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 500,
                              letterSpacing: '0.1em',
                              padding: '2px 8px',
                              borderRadius: '3px',
                              color: categoryColors[item.category].color,
                              backgroundColor: categoryColors[item.category].bg,
                            }}
                          >
                            {categoryLabels[item.category]}
                          </span>
                        </div>

                        {/* Title */}
                        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
                          {item.title}
                        </p>
                      </div>
                      {i < items.length - 1 && (
                        <Separator className="opacity-30" />
                      )}
                    </div>
                  ))}
                  <Separator className="mt-2 opacity-20" />
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-muted-foreground text-sm text-center" style={{ padding: '3rem 0' }}>
            No entries match this filter.
          </p>
        )}
      </main>
    </>
  );
}
