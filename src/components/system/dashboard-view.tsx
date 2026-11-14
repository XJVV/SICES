"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BookOpen, Database, FlaskConical, Gauge, Layers, Satellite, Signal } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useCountUp } from "@/hooks/use-count-up";
import {
  CHART_COLORS,
  COMBUSTION_TYPES,
  SERIES_PALETTE,
  type Investigation,
  type Publication,
} from "@/lib/types";
import { CombustionBadge } from "./badges";

interface DashboardViewProps {
  investigations: Investigation[];
  publications: Publication[];
  measurementsTotal: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  suffix,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  suffix?: string;
}) {
  const animated = useCountUp(value);
  return (
    <div className="hud-panel stat-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="hud-label leading-tight">{label}</span>
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
      <p className="display-title data-mono mt-2 text-3xl font-bold text-foreground">
        {animated.toLocaleString()}
        {suffix ? <span className="text-lg text-primary">{suffix}</span> : null}
      </p>
    </div>
  );
}

export function DashboardView({ investigations, publications, measurementsTotal }: DashboardViewProps) {
  const { t, lang } = useLanguage();

  const total = investigations.length;
  const principal = investigations.filter((i) => i.category === "PRINCIPAL").length;
  const complementary = total - principal;
  const filesTotal = investigations.reduce((acc, i) => acc + (i.filesCount ?? 0), 0);

  const byCombustion = COMBUSTION_TYPES.map((type) => ({
    name: t.combustionLabel[type],
    value: investigations.filter((i) => i.combustionType === type).length,
    key: type,
  }));

  // Cronología de misiones: experimentos con fecha de inicio
  const timeline = investigations
    .filter((i) => i.startDate)
    .sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1))
    .map((i) => ({
      shortName: i.shortName,
      psiCode: i.psiCode,
      start: new Date(i.startDate!).getFullYear(),
      end: i.endDate ? new Date(i.endDate).getFullYear() : new Date().getFullYear(),
      combustionType: i.combustionType,
    }));
  const timelineMin = timeline.length ? Math.min(...timeline.map((x) => x.start)) : 2007;
  const timelineMax = timeline.length ? Math.max(...timeline.map((x) => x.end)) : 2020;

  const axisStyle = { fontSize: 11, fill: "var(--muted-foreground)" };
  const tooltipStyle = {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--hud-border)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "var(--popover-foreground)",
    backdropFilter: "blur(8px)",
  };

  return (
    <div className="animate-fade-up space-y-6">
      {/* Hero de misión */}
      <section className="hud-panel relative overflow-hidden p-6">
        <div className="mission-stripe absolute inset-x-0 top-0" aria-hidden="true" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="live-dot" aria-hidden="true" />
              <span className="hud-label">{lang === "es" ? "Estado del sistema · Operativo" : "System status · Operational"}</span>
            </div>
            <h2 className="display-title text-2xl font-bold leading-tight sm:text-3xl">
              {t.dashboard.introTitle}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t.dashboard.intro}</p>
            <p className="text-xs text-muted-foreground/80">{t.dashboard.license}</p>
          </div>
          <div className="data-mono hidden shrink-0 flex-col items-end gap-1 text-right text-[11px] text-muted-foreground md:flex">
            <span>ISS · MSG · Cygnus</span>
            <span className="text-primary">μ-Δg COMBUSTION LAB</span>
            <span>{new Date().getFullYear()}</span>
          </div>
        </div>
      </section>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t.dashboard.statsTotal} value={total} icon={FlaskConical} />
        <StatCard label={t.dashboard.statsPrincipal} value={principal} icon={Layers} />
        <StatCard label={t.dashboard.statsComplementary} value={complementary} icon={Satellite} />
        <StatCard label={t.dashboard.statsPublications} value={publications.length} icon={BookOpen} />
        <StatCard label={t.dashboard.statsFiles} value={filesTotal} icon={Database} />
        <StatCard label={t.field.measurements} value={measurementsTotal} icon={Activity} />
      </div>

      {/* Gráficos superiores */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="hud-panel p-4 lg:col-span-2">
          <p className="hud-label mb-3">{t.dashboard.chartByCombustion}</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCombustion}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={3}
                  stroke="var(--background)"
                  strokeWidth={2}
                >
                  {byCombustion.map((entry) => (
                    <Cell key={entry.key} fill={CHART_COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {byCombustion.map((entry) => (
              <div key={entry.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: CHART_COLORS[entry.key] }}
                  aria-hidden="true"
                />
                {entry.name} ({entry.value})
              </div>
            ))}
          </div>
        </div>

        {/* Cronología de misiones */}
        <div className="hud-panel p-4 lg:col-span-3">
          <p className="hud-label mb-3">{t.dashboard.timeline}</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[timelineMin, timelineMax]}
                  tick={axisStyle}
                  stroke="var(--border)"
                  tickFormatter={(v: number) => `${v}`}
                />
                <YAxis type="category" dataKey="shortName" width={86} tick={axisStyle} stroke="var(--border)" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  formatter={(value: unknown, name: unknown) =>
                    [String(value), name === "start" ? t.dashboard.timelineStart : t.dashboard.timelineEnd] as [string, string]
                  }
                />
                <Bar dataKey="start" stackId="a" fill="transparent" />
                <Bar dataKey="end" stackId="a" radius={[0, 3, 3, 0]}>
                  {timeline.map((entry, i) => (
                    <Cell key={entry.psiCode} fill={SERIES_PALETTE[i % SERIES_PALETTE.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Conclusiones clave */}
      <div className="hud-panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="hud-label">{t.dashboard.conclusionsTitle}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {t.dashboard.conclusions.map((c, i) => (
            <div key={i} className="flex gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
              <span className="data-mono shrink-0 text-xs font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
              <p className="text-xs leading-relaxed text-muted-foreground">{c}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actividad de la flota de experimentos */}
      <div className="hud-panel p-4">
        <div className="mb-3 flex items-center gap-2">
          <Signal className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="hud-label">{t.dashboard.fleetTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {investigations.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5"
            >
              <span className="data-mono text-xs font-semibold">{inv.shortName}</span>
              <CombustionBadge type={inv.combustionType} />
              <span className="data-mono text-[10px] text-muted-foreground">
                {inv._count?.measurements ?? 0} {t.field.measurements.toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
