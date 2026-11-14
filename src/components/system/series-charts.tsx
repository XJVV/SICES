"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { Measurement } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Catálogo de métricas de telemetría                                  */
/* ------------------------------------------------------------------ */

export type MetricKey =
  | "o2Initial"
  | "o2Final"
  | "co2"
  | "co"
  | "pressure"
  | "temperature"
  | "flow"
  | "radiation"
  | "propagationSpeed";

export interface MetricDef {
  key: MetricKey;
  es: string;
  en: string;
  unit: string;
  digits: number;
  /** factor de escala (fracción de O₂ → %) */
  scale: number;
}

export const METRICS: MetricDef[] = [
  { key: "o2Initial", es: "O₂ inicial", en: "Initial O₂", unit: "%", digits: 1, scale: 100 },
  { key: "o2Final", es: "O₂ final", en: "Final O₂", unit: "%", digits: 1, scale: 100 },
  { key: "co2", es: "CO₂", en: "CO₂", unit: "%", digits: 2, scale: 1 },
  { key: "co", es: "CO", en: "CO", unit: "ppm", digits: 1, scale: 1 },
  { key: "pressure", es: "Presión", en: "Pressure", unit: "atm", digits: 2, scale: 1 },
  { key: "temperature", es: "Temperatura", en: "Temperature", unit: "°C", digits: 1, scale: 1 },
  { key: "flow", es: "Flujo", en: "Flow", unit: "cm/s", digits: 1, scale: 1 },
  { key: "radiation", es: "Radiación", en: "Radiation", unit: "W/cm²", digits: 2, scale: 1 },
  { key: "propagationSpeed", es: "Vel. propagación", en: "Spread rate", unit: "cm/s", digits: 3, scale: 1 },
];

export function metricDef(key: MetricKey): MetricDef {
  return METRICS.find((m) => m.key === key) ?? METRICS[0];
}

export function metricLabel(def: MetricDef, lang: string): string {
  return lang === "es" ? def.es : def.en;
}

export function metricFullLabel(key: MetricKey, lang: string): string {
  const def = metricDef(key);
  return `${metricLabel(def, lang)} (${def.unit})`;
}

/* ------------------------------------------------------------------ */
/* Definición de serie y utilidades                                    */
/* ------------------------------------------------------------------ */

export interface SeriesDef {
  id: number;
  name: string;
  psiCode: string;
  color: string;
  rows: Measurement[];
}

export interface MetricPoint {
  t: number;
  v: number;
  rowId: number;
}

export function seriesPoints(s: SeriesDef, key: MetricKey): MetricPoint[] {
  const def = metricDef(key);
  const out: MetricPoint[] = [];
  for (const r of s.rows) {
    const raw = r[key];
    if (raw === null || raw === undefined || !r.date) continue;
    out.push({ t: new Date(r.date).getTime(), v: raw * def.scale, rowId: r.id });
  }
  return out.sort((a, b) => a.t - b.t);
}

export interface SeriesStats {
  count: number;
  avg: number;
  min: number;
  max: number;
}

export function pointsStats(points: Array<{ v: number }>): SeriesStats | null {
  if (points.length === 0) return null;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    sum += p.v;
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  return { count: points.length, avg: sum / points.length, min, max };
}

export function availableMetrics(s: SeriesDef): MetricKey[] {
  return METRICS.filter((m) => seriesPoints(s, m.key).length > 0).map((m) => m.key);
}

/* ------------------------------------------------------------------ */
/* Estilos compartidos                                                 */
/* ------------------------------------------------------------------ */

const axisStyle = { fontSize: 10, fill: "var(--muted-foreground)" };
const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--hud-border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
  backdropFilter: "blur(8px)",
};

function fmtDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Eje temporal relativo: días transcurridos desde el inicio de cada   */
/* serie (día 0). Así, al superponer experimentos, las curvas se       */
/* alinean por forma y no por fecha de calendario.                     */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

export interface RelPoint {
  /** días transcurridos desde el primer punto de la serie */
  d: number;
  v: number;
  rowId: number;
}

interface ElapsedStrings {
  day: string;
  dayShort: string;
  dayZero: (isoDate: string) => string;
  caption: string;
}

function elapsedStrings(lang: string): ElapsedStrings {
  const es = lang === "es";
  return {
    day: es ? "Día" : "Day",
    dayShort: "d",
    dayZero: (isoDate: string) => (es ? `día 0 = ${isoDate}` : `day 0 = ${isoDate}`),
    caption: es
      ? "Eje X: tiempo transcurrido desde el inicio de cada experimento (día 0), no fechas de calendario — así las curvas se alinean por forma y la superposición es comparable."
      : "X axis: elapsed time since each experiment start (day 0), not calendar dates — curves align by shape so the overlay is comparable.",
  };
}

function fmtElapsedDay(n: number): string {
  return Number(n.toFixed(1)).toString();
}

/** Convierte los puntos de una serie a tiempo relativo (días desde su inicio) */
export function relativePoints(pts: MetricPoint[]): { t0: number; rel: RelPoint[] } {
  if (pts.length === 0) return { t0: 0, rel: [] };
  const t0 = pts[0].t;
  return { t0, rel: pts.map((p) => ({ d: (p.t - t0) / DAY_MS, v: p.v, rowId: p.rowId })) };
}

/* ------------------------------------------------------------------ */
/* Gráfica de superposición (varias series, un mismo eje)              */
/* ------------------------------------------------------------------ */

interface OverlayChartProps {
  series: SeriesDef[];
  metricKey: MetricKey;
  normalized?: boolean;
  height?: number;
  /** id del registro a resaltar (punto pulsante) */
  highlightRowId?: number | null;
}

export function OverlayChart({
  series,
  metricKey,
  normalized = false,
  height = 260,
  highlightRowId = null,
}: OverlayChartProps) {
  const { lang } = useLanguage();
  const L = elapsedStrings(lang);
  const def = metricDef(metricKey);

  const withPts = series
    .map((s) => {
      const { t0, rel } = relativePoints(seriesPoints(s, metricKey));
      return { s, t0, pts: rel };
    })
    .filter((x) => x.pts.length > 0);
  const missing = series.filter((s) => seriesPoints(s, metricKey).length === 0);

  // fusionar por día relativo: cada experimento empieza en su día 0
  const maxBy = new Map<string, number>();
  for (const { s, pts } of withPts) {
    maxBy.set(s.name, Math.max(...pts.map((p) => p.v)));
  }
  const byD = new Map<number, Record<string, number>>();
  for (const { s, pts } of withPts) {
    const max = maxBy.get(s.name) ?? 1;
    for (const p of pts) {
      const d = Math.round(p.d * 100) / 100;
      const row = byD.get(d) ?? {};
      row[s.name] = normalized ? (p.v / max) * 100 : p.v;
      byD.set(d, row);
    }
  }
  const data = [...byD.entries()]
    .map(([d, vals]) => ({ d, ...vals }))
    .sort((a, b) => a.d - b.d);

  // punto resaltado
  let highlight: { x: number; y: number; color: string } | null = null;
  if (highlightRowId !== null) {
    for (const { s, pts } of withPts) {
      const p = pts.find((q) => q.rowId === highlightRowId);
      if (p) {
        const max = maxBy.get(s.name) ?? 1;
        highlight = { x: p.d, y: normalized ? (p.v / max) * 100 : p.v, color: s.color };
        break;
      }
    }
  }

  if (withPts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height }}>
        <Activity className="h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">—</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="d"
              type="number"
              domain={[0, "dataMax"]}
              tickFormatter={(v: number) => `${Math.round(v)} ${L.dayShort}`}
              tick={axisStyle}
              stroke="var(--border)"
            />
            <YAxis
              tick={axisStyle}
              stroke="var(--border)"
              width={58}
              label={
                normalized
                  ? undefined
                  : {
                      value: def.unit,
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 10, fill: "var(--muted-foreground)" },
                    }
              }
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(l) => `${L.day} ${fmtElapsedDay(Number(l))}`}
              formatter={(value: unknown, name: unknown) =>
                [
                  normalized ? `${Number(value).toFixed(1)} %` : `${Number(value).toFixed(def.digits)} ${def.unit}`,
                  String(name),
                ] as [string, string]
              }
            />
            {withPts.map(({ s }) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.name}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 2, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 1 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
            {highlight ? (
              <ReferenceDot
                x={highlight.x}
                y={highlight.y}
                r={5}
                fill={highlight.color}
                stroke="var(--background)"
                strokeWidth={2}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {withPts.map(({ s, pts }) => (
          <span key={s.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.name}
            <span className="data-mono text-[10px] text-muted-foreground/70">({pts.length})</span>
          </span>
        ))}
        {missing.map((s) => (
          <span
            key={s.id}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 line-through"
          >
            <span className="h-2 w-2 rounded-full border border-dashed border-muted-foreground/60" aria-hidden="true" />
            {s.name}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground/70">{L.caption}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rejilla de gráficas gemelas (independientes y equivalentes)         */
/* ------------------------------------------------------------------ */

interface TwinChartGridProps {
  series: SeriesDef[];
  metricKey: MetricKey;
  height?: number;
  highlightRowId?: number | null;
  labels?: { missing: string; available: string; avg: string; min: string; max: string; pts: (n: number) => string };
}

export function TwinChartGrid({
  series,
  metricKey,
  height = 190,
  highlightRowId = null,
  labels,
}: TwinChartGridProps) {
  const { lang } = useLanguage();
  const L = elapsedStrings(lang);
  const def = metricDef(metricKey);
  const miss = labels?.missing ?? "no registra esta variable";
  const avail = labels?.available ?? "disponibles";
  const avgL = labels?.avg ?? "media";
  const minL = labels?.min ?? "mín";
  const maxL = labels?.max ?? "máx";
  const ptsL = labels?.pts ?? ((n: number) => `${n} pts`);

  const panels = series.map((s) => {
    const { t0, rel } = relativePoints(seriesPoints(s, metricKey));
    return { s, t0, pts: rel, stats: pointsStats(rel), availKeys: availableMetrics(s) };
  });
  // dominio X común: los paneles comparten la misma escala temporal (días)
  const commonMax = Math.max(0, ...panels.map((p) => (p.pts.length ? p.pts[p.pts.length - 1].d : 0)));

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        {panels.map(({ s, t0, pts, stats, availKeys }) => {
          const hl = highlightRowId !== null ? pts.find((p) => p.rowId === highlightRowId) : undefined;
          return (
            <div key={s.id} className="hud-panel p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                  <span className="display-title text-sm font-bold">{s.name}</span>
                  <span className="data-mono text-[10px] text-muted-foreground">{s.psiCode}</span>
                  {stats ? (
                    <span className="data-mono text-[10px] text-muted-foreground/70">{L.dayZero(fmtDay(t0))}</span>
                  ) : null}
                </div>
                {stats ? (
                  <span className="data-mono text-[10px] text-muted-foreground">
                    {avgL} {stats.avg.toFixed(def.digits)} · {minL} {stats.min.toFixed(def.digits)} · {maxL}{" "}
                    {stats.max.toFixed(def.digits)} · {ptsL(stats.count)}
                  </span>
                ) : null}
              </div>
              {stats ? (
                <div style={{ height }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={pts.map((p) => ({ d: p.d, v: p.v }))}
                      margin={{ top: 8, right: 10, bottom: 0, left: -14 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="d"
                        type="number"
                        domain={[0, commonMax]}
                        tickFormatter={(v: number) => `${Math.round(v)} ${L.dayShort}`}
                        tick={axisStyle}
                        stroke="var(--border)"
                      />
                      <YAxis
                        tick={axisStyle}
                        stroke="var(--border)"
                        width={52}
                        label={{
                          value: def.unit,
                          angle: -90,
                          position: "insideLeft",
                          style: { fontSize: 10, fill: "var(--muted-foreground)" },
                        }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(l) =>
                          `${L.day} ${fmtElapsedDay(Number(l))} · ${fmtDay(t0 + Number(l) * DAY_MS)}`
                        }
                        formatter={(value: unknown) =>
                          [`${Number(value).toFixed(def.digits)} ${def.unit}`, metricLabel(def, lang)] as [string, string]
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={s.color}
                        strokeWidth={2}
                        dot={{ r: 2, fill: s.color, strokeWidth: 0 }}
                        activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 1 }}
                        isAnimationActive={false}
                      />
                      {hl ? (
                        <ReferenceDot
                          x={hl.d}
                          y={hl.v}
                          r={5}
                          fill={s.color}
                          stroke="var(--background)"
                          strokeWidth={2}
                        />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/70 bg-muted/10 text-center"
                  style={{ height }}
                >
                  <Activity className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold">{s.name}</span> {miss}
                  </p>
                  {availKeys.length > 0 ? (
                    <p className="text-[10px] text-muted-foreground/70">
                      {avail}: {availKeys.map((k) => metricLabel(metricDef(k), lang)).join(" · ")}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {panels.some((p) => p.stats) ? (
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground/70">{L.caption}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barras horizontales de media por experimento                        */
/* ------------------------------------------------------------------ */

interface AvgBarChartProps {
  series: SeriesDef[];
  metricKey: MetricKey;
}

export function AvgBarChart({ series, metricKey }: AvgBarChartProps) {
  const def = metricDef(metricKey);
  const items = series
    .map((s) => {
      const stats = pointsStats(seriesPoints(s, metricKey));
      return stats ? { name: s.name, color: s.color, avg: stats.avg, count: stats.count } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (items.length === 0) return null;
  const data = items.map((it) => ({ ...it, avg: Number(it.avg.toFixed(def.digits)) }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(110, data.length * 46)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={axisStyle} stroke="var(--border)" />
        <YAxis
          type="category"
          dataKey="name"
          width={92}
          tick={{ fontSize: 11, fill: "var(--foreground)" }}
          stroke="var(--border)"
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--muted)", opacity: 0.3 }}
          formatter={(value: unknown) =>
            [`${Number(value).toFixed(def.digits)} ${def.unit}`, "μ"] as [string, string]
          }
        />
        <Bar dataKey="avg" radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} fillOpacity={0.85} />
          ))}
          <LabelList
            dataKey="avg"
            position="right"
            formatter={(v: unknown) => `${Number(v).toFixed(def.digits)} ${def.unit}`}
            style={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Selector de modo (auto / superpuestas / gemelas)                    */
/* ------------------------------------------------------------------ */

export type ChartMode = "auto" | "overlay" | "twin";

export function ModeSelector({
  mode,
  onChange,
  labels,
}: {
  mode: ChartMode;
  onChange: (m: ChartMode) => void;
  labels: { mode: string; auto: string; overlay: string; twin: string };
}) {
  const opts: { key: ChartMode; label: string }[] = [
    { key: "auto", label: labels.auto },
    { key: "overlay", label: labels.overlay },
    { key: "twin", label: labels.twin },
  ];
  return (
    <div
      className="flex items-center rounded-md border border-border/60"
      role="group"
      aria-label={labels.mode}
    >
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={mode === o.key}
          className={`data-mono rounded px-2.5 py-1 text-[11px] font-bold transition-colors ${
            mode === o.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
