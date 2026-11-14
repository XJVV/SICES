"use client";

import * as React from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, ExternalLink, LineChart as LineChartIcon, RefreshCcw, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/i18n";
import { SERIES_PALETTE, type AnalyzedDataset, type AnalyzedSeries, type Investigation } from "@/lib/types";
import { ImportDialog } from "./import-dialog";
import { AiAssistantPanel } from "./ai-assistant-panel";

/* ------------------------------------------------------------------ */
/* Catálogo de métricas (mismo eje X y unidad Y ⇒ superponibles)        */
/* ------------------------------------------------------------------ */

interface MetricDef {
  key: string;
  es: string;
  en: string;
}

const METRIC_CATALOG: MetricDef[] = [
  { key: "d2", es: "d² — área de la gota", en: "d² — droplet area" },
  { key: "d2_norm", es: "(D/D₀)² · t normalizado", en: "(D/D₀)² · normalized t" },
  { key: "d2_norm_t", es: "(D/D₀)² · t en s", en: "(D/D₀)² · t in s" },
  { key: "diameter", es: "Diámetro de gota D", en: "Droplet diameter D" },
  { key: "dflame", es: "Diámetro de llama", en: "Flame diameter" },
  { key: "dflame_tnorm", es: "Diámetro de llama · t/d₀²", en: "Flame diameter · t/d₀²" },
  { key: "dflame_ratio", es: "D_llama / D₀", en: "Flame / drop ratio" },
  { key: "radiance", es: "Radiancia", en: "Radiance" },
  { key: "radiance_tnorm", es: "Radiancia · t/d₀²", en: "Radiance · t/d₀²" },
  { key: "tmax", es: "T máxima de reacción", en: "Max reaction temp." },
  { key: "k", es: "Tasa de combustión K", en: "Burning rate K" },
  { key: "d_tmax", es: "D_Tmáx / D₀", en: "D_Tmax / D₀" },
  { key: "d_ohm", es: "D_OH,m / D₀", en: "D_OH,m / D₀" },
  { key: "coolflame_dia", es: "Diámetro de llama fría", en: "Cool-flame diameter" },
  { key: "dext_hf_do", es: "D_ext llama caliente · vs D₀", en: "Hot-flame D_ext · vs D₀" },
  { key: "dext_cf_do", es: "D_ext llama fría · vs D₀", en: "Cool-flame D_ext · vs D₀" },
  { key: "dext_hf_p", es: "D_ext llama caliente · vs P", en: "Hot-flame D_ext · vs P" },
  { key: "dext_cf_p", es: "D_ext llama fría · vs P", en: "Cool-flame D_ext · vs P" },
  { key: "kavg_p", es: "K promedio · vs P", en: "Avg. K · vs P" },
  /* Tablas experimentales (matrices de pruebas, p. ej. ACME CFI-G) */
  { key: "hcrate_p", es: "Caudal de combustible · vs P", en: "Fuel flow rate · vs P" },
  { key: "hcrate_o2", es: "Caudal de combustible · vs X_O₂", en: "Fuel flow rate · vs X_O₂" },
  { key: "o2rate_p", es: "Caudal de O₂ · vs P", en: "O₂ flow rate · vs P" },
  { key: "o2rate_o2", es: "Caudal de O₂ · vs X_O₂", en: "O₂ flow rate · vs X_O₂" },
  { key: "burntime_p", es: "Tiempo de combustión · vs P", en: "Burn time · vs P" },
  { key: "burntime_o2", es: "Tiempo de combustión · vs X_O₂", en: "Burn time · vs X_O₂" },
  { key: "peaktemp_p", es: "T pico del quemador (°C) · vs P", en: "Peak burner T (°C) · vs P" },
  { key: "peaktemp_o2", es: "T pico del quemador (°C) · vs X_O₂", en: "Peak burner T (°C) · vs X_O₂" },
  { key: "peaktempk_p", es: "T pico del quemador (K) · vs P", en: "Peak burner T (K) · vs P" },
  { key: "peaktempk_o2", es: "T pico del quemador (K) · vs X_O₂", en: "Peak burner T (K) · vs X_O₂" },
  { key: "tad_p", es: "T adiabática de llama · vs P", en: "Adiabatic flame T · vs P" },
  { key: "tad_o2", es: "T adiabática de llama · vs X_O₂", en: "Adiabatic flame T · vs X_O₂" },
  { key: "zst_p", es: "Z_st estequiométrico · vs P", en: "Z_st stoichiometric · vs P" },
  { key: "zst_o2", es: "Z_st estequiométrico · vs X_O₂", en: "Z_st stoichiometric · vs X_O₂" },
  { key: "xf_p", es: "X_f fracción de combustible · vs P", en: "X_f fuel fraction · vs P" },
  { key: "xf_o2", es: "X_f fracción de combustible · vs X_O₂", en: "X_f fuel fraction · vs X_O₂" },
  { key: "xf_before_p", es: "X_f antes de la prueba · vs P", en: "X_f before test · vs P" },
  { key: "xf_before_o2", es: "X_f antes de la prueba · vs X_O₂", en: "X_f before test · vs X_O₂" },
  { key: "xf_after_p", es: "X_f tras la prueba · vs P", en: "X_f after test · vs P" },
  { key: "xf_after_o2", es: "X_f tras la prueba · vs X_O₂", en: "X_f after test · vs X_O₂" },
  { key: "xo2_after_p", es: "X_O₂ tras la prueba · vs P", en: "X_O₂ after test · vs P" },
  { key: "xo2_after_o2", es: "X_O₂ tras la prueba · vs X_O₂", en: "X_O₂ after test · vs X_O₂" },
];

const X_KIND_INFO: Record<string, { es: string; en: string; unit: string }> = {
  time_s: { es: "Tiempo", en: "Time", unit: "s" },
  time_norm: { es: "t/d₀²", en: "t/d₀²", unit: "s/mm²" },
  pressure_atm: { es: "Presión", en: "Pressure", unit: "atm" },
  pressure_bar: { es: "Presión", en: "Pressure", unit: "bar" },
  xo2: { es: "X_O₂ (fracción molar)", en: "X_O₂ (mole fraction)", unit: "-" },
  diameter_mm: { es: "Diámetro inicial D₀", en: "Initial diameter D₀", unit: "mm" },
};

const SOURCE_STYLES: Record<string, string> = {
  EXPERIMENT: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  SIMULATION: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  MODEL: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

function metricLabel(key: string, lang: string): string {
  const def = METRIC_CATALOG.find((m) => m.key === key);
  if (!def) {
    // métrica no catalogada (importado): humanizar la clave
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return lang === "es" ? def.es : def.en;
}

function fmtNum(v: number, sig = 4): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 100000 || abs < 0.001) return v.toExponential(2);
  return String(Number(v.toPrecision(sig)));
}

function fmtTick(v: number, xKind: string): string {
  const abs = Math.abs(v);
  if (xKind === "time_s" && abs >= 10) return String(Math.round(v));
  if (abs >= 100) return String(Math.round(v));
  return String(Number(v.toPrecision(3)));
}

/** Sufijo «(unidad)» para etiquetas de eje; vacío si es adimensional. */
function unitSuffix(u: string | undefined): string {
  if (!u || u === "-") return "";
  return ` (${u})`;
}

/* ------------------------------------------------------------------ */
/* Construcción de datos: una fila por x, columnas por serie           */
/* ------------------------------------------------------------------ */

interface ChartRow {
  x: number;
  [key: string]: number | number[] | undefined;
}

interface PreparedSeries {
  meta: AnalyzedSeries;
  dataset: AnalyzedDataset;
  color: string;
  key: string; // v0, v1...
  errKey: string; // e0, e1... ([offsetInf, offsetSup])
  hasErr: boolean;
  max: number;
}

function prepareSeries(
  seriesList: { s: AnalyzedSeries; d: AnalyzedDataset }[]
): PreparedSeries[] {
  return seriesList.map(({ s, d }, i) => {
    let max = 0;
    let hasErr = false;
    for (const p of s.points) {
      if (p.length >= 4) hasErr = true;
      if (p[1] > max) max = p[1];
    }
    if (max === 0) max = 1;
    return {
      meta: s,
      dataset: d,
      color: SERIES_PALETTE[i % SERIES_PALETTE.length],
      key: `v${i}`,
      errKey: `e${i}`,
      hasErr,
      max,
    };
  });
}

function buildRows(prepared: PreparedSeries[], normalized: boolean): ChartRow[] {
  const rows: ChartRow[] = [];
  const byX = new Map<number, ChartRow>();
  prepared.forEach((p) => {
    for (const pt of p.meta.points) {
      const [x, y, hi, lo] = pt;
      let row = byX.get(x);
      if (row === undefined || row[p.key] !== undefined) {
        row = { x };
        rows.push(row);
        if (!byX.has(x)) byX.set(x, row);
      }
      const v = normalized ? (y / p.max) * 100 : y;
      row[p.key] = v;
      if (hi !== undefined && lo !== undefined) {
        const loOff = normalized ? v - (lo / p.max) * 100 : v - lo;
        const hiOff = normalized ? (hi / p.max) * 100 - v : hi - v;
        row[p.errKey] = [loOff, hiOff];
      }
    }
  });
  rows.sort((a, b) => a.x - b.x);
  return rows;
}

/* Símbolo experimental con barras de error verticales (±[loOff, hiOff]
   sobre el valor y). Dibuja la barra con la escala Y del propio punto. */
function makeErrorDotShape(color: string, key: string, errKey: string) {
  return function ErrorDot(props: unknown) {
    const { cx, cy, payload, yAxis } = props as {
      cx: number;
      cy: number;
      payload?: Record<string, number | number[] | undefined>;
      yAxis?: { scale?: (v: number) => number };
    };
    const yVal = payload?.[key];
    const err = payload?.[errKey] as [number, number] | undefined;
    if (
      err === undefined ||
      !Array.isArray(err) ||
      typeof yVal !== "number" ||
      !yAxis?.scale
    ) {
      return <circle cx={cx} cy={cy} r={3} fill={color} fillOpacity={0.9} />;
    }
    const [loOff, hiOff] = err;
    const yHi = yAxis.scale(yVal + hiOff);
    const yLo = yAxis.scale(yVal - loOff);
    return (
      <g>
        {Number.isFinite(yHi) && Number.isFinite(yLo) ? (
          <>
            <line x1={cx} x2={cx} y1={yHi} y2={yLo} stroke={color} strokeWidth={1.2} strokeOpacity={0.9} />
            <line x1={cx - 3} x2={cx + 3} y1={yHi} y2={yHi} stroke={color} strokeWidth={1.2} strokeOpacity={0.9} />
            <line x1={cx - 3} x2={cx + 3} y1={yLo} y2={yLo} stroke={color} strokeWidth={1.2} strokeOpacity={0.9} />
          </>
        ) : null}
        <circle cx={cx} cy={cy} r={3} fill={color} fillOpacity={0.95} />
      </g>
    );
  };
}

/* ------------------------------------------------------------------ */
/* Tooltip personalizado                                               */
/* ------------------------------------------------------------------ */

function AnalyzedTooltip({
  active,
  payload,
  label,
  prepared,
  lang,
  xUnit,
  yUnit,
  normalized,
  sourceLabels,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number }>;
  label?: number | string;
  prepared: PreparedSeries[];
  lang: string;
  xUnit: string;
  yUnit: string;
  normalized: boolean;
  sourceLabels: Record<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entries = payload
    .map((pl) => prepared.find((p) => p.key === pl.dataKey))
    .filter((p): p is PreparedSeries => p !== undefined);
  if (entries.length === 0) return null;
  return (
    <div
      className="rounded-lg border border-[var(--hud-border)] bg-[var(--popover)] p-3 text-xs shadow-xl backdrop-blur"
      style={{ minWidth: 190 }}
    >
      <p className="data-mono mb-1.5 font-bold text-[var(--popover-foreground)]">
        X = {fmtNum(Number(label))}
        {xUnit && xUnit !== "-" ? ` ${xUnit}` : ""}
      </p>
      <div className="space-y-1">
        {entries.map((p) => (
          <div key={p.meta.id} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
              aria-hidden="true"
            />
            <span className="font-medium text-[var(--popover-foreground)]">
              {p.meta.label} <span className="text-muted-foreground">· {p.dataset.tag}</span>
            </span>
            <span className="data-mono ml-auto text-[var(--popover-foreground)]">
              {tooltipValue(p, payload, normalized, yUnit)}
            </span>
            <span
              className="rounded border px-1 text-[9px] uppercase tracking-wide text-muted-foreground"
              style={{ borderColor: "var(--border)" }}
            >
              {sourceLabels[p.meta.source] ?? p.meta.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function tooltipValue(
  p: PreparedSeries,
  payload: Array<{ dataKey?: string | number; value?: number | string }>,
  normalized: boolean,
  yUnit: string
): string {
  const entry = payload.find((pl) => pl.dataKey === p.key);
  const raw = entry?.value;
  if (raw === undefined || raw === null) return "—";
  const n = Number(raw);
  if (normalized) return `${n.toFixed(1)} %`;
  return `${fmtNum(n)} ${yUnit}`;
}

/* ------------------------------------------------------------------ */
/* Vista principal                                                     */
/* ------------------------------------------------------------------ */

export function AnalysisView({ investigations = [] }: { investigations?: Investigation[] }) {
  const { t, lang } = useLanguage();
  const A = t.analysis;

  const [datasets, setDatasets] = React.useState<AnalyzedDataset[] | null>(null);
  const [error, setError] = React.useState(false);
  const [invId, setInvId] = React.useState<number | null>(null);
  const [enabledKeys, setEnabledKeys] = React.useState<Set<string> | null>(null);
  const [metric, setMetric] = React.useState<string | null>(null);
  const [hidden, setHidden] = React.useState<Set<number>>(new Set());
  const [normalized, setNormalized] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  const load = React.useCallback(() => {
    setError(false);
    fetch("/api/series")
      .then((r) => {
        if (!r.ok) throw new Error("bad status");
        return r.json();
      })
      .then((data: AnalyzedDataset[]) => {
        setDatasets(data);
        setEnabledKeys(new Set(data.map((d) => d.key)));
      })
      .catch(() => setError(true));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Investigaciones con datos analizados
  const invs = React.useMemo(() => {
    if (!datasets) return [];
    const map = new Map<number, AnalyzedDataset["investigation"]>();
    for (const d of datasets) {
      if (!map.has(d.investigationId)) map.set(d.investigationId, d.investigation);
    }
    return [...map.values()];
  }, [datasets]);

  const activeInvId = invId ?? invs[0]?.id ?? null;
  const invDatasets = React.useMemo(
    () => (datasets ?? []).filter((d) => d.investigationId === activeInvId),
    [datasets, activeInvId]
  );

  // Métricas disponibles en los conjuntos habilitados
  const metricCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of invDatasets) {
      if (!enabledKeys?.has(d.key)) continue;
      for (const s of d.series) counts.set(s.metric, (counts.get(s.metric) ?? 0) + 1);
    }
    return counts;
  }, [invDatasets, enabledKeys]);

  const metricOrder = React.useMemo(() => {
    const known = METRIC_CATALOG.filter((m) => metricCounts.has(m.key)).map((m) => m.key);
    const unknown = [...metricCounts.keys()].filter((k) => !METRIC_CATALOG.some((m) => m.key === k));
    return [...known, ...unknown];
  }, [metricCounts]);

  // Métrica efectiva (auto-corrección al cambiar filtros)
  const effectiveMetric =
    metric && metricCounts.has(metric) ? metric : (metricOrder[0] ?? null);

  const currentPairs = React.useMemo(() => {
    if (!effectiveMetric) return [];
    const pairs: { s: AnalyzedSeries; d: AnalyzedDataset }[] = [];
    for (const d of invDatasets) {
      if (!enabledKeys?.has(d.key)) continue;
      for (const s of d.series) {
        if (s.metric === effectiveMetric) pairs.push({ s, d });
      }
    }
    pairs.sort((a, b) => a.d.sort - b.d.sort || a.s.sort - b.s.sort);
    return pairs;
  }, [invDatasets, enabledKeys, effectiveMetric]);

  const visiblePairs = currentPairs.filter((p) => !hidden.has(p.s.id));
  const prepared = React.useMemo(() => prepareSeries(visiblePairs), [visiblePairs]);
  const rows = React.useMemo(() => buildRows(prepared, normalized), [prepared, normalized]);

  const xKind = currentPairs[0]?.s.xKind ?? "time_s";
  const xUnit = currentPairs[0]?.s.xUnit ?? X_KIND_INFO[xKind]?.unit ?? "";
  const yUnit = currentPairs[0]?.s.yUnit ?? "";
  const xInfo = X_KIND_INFO[xKind];
  const isTime = xKind === "time_s" || xKind === "time_norm";
  const multipleDatasets = new Set(visiblePairs.map((p) => p.d.id)).size > 1;

  // Dominio Y que incluya los límites de las barras de error
  const yDomainMax = React.useMemo(() => {
    let max = 0;
    for (const p of prepared) {
      for (const pt of p.meta.points) {
        const v = normalized ? (pt[1] / p.max) * 100 : pt[1];
        if (v > max) max = v;
        if (pt.length >= 4) {
          const hi = normalized ? (pt[2] / p.max) * 100 : pt[2];
          if (hi > max) max = hi;
        }
      }
    }
    return max;
  }, [prepared, normalized]);

  const totalPoints = invDatasets.reduce(
    (acc, d) => acc + d.series.reduce((a, s) => a + s.points.length, 0),
    0
  );

  const toggleDataset = (key: string) => {
    setEnabledKeys((prev) => {
      const base = prev ?? new Set(datasets?.map((d) => d.key) ?? []);
      const next = new Set(base);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSeries = (id: number) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">{t.common.errorLoad}</p>
        <Button onClick={load} variant="outline">
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          {t.common.retry}
        </Button>
      </div>
    );
  }

  if (!datasets) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="data-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {t.common.loading}
        </p>
      </div>
    );
  }

  if (invDatasets.length === 0) {
    return (
      <div className="hud-panel flex min-h-[30vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <Activity className="h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
        <p className="max-w-md text-sm text-muted-foreground">{A.noData}</p>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
          {t.importData.button}
        </Button>
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={load}
          existingCodes={investigations.map((i) => i.psiCode)}
        />
      </div>
    );
  }

  const inv = invs.find((i) => i.id === activeInvId);

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display-title flex items-center gap-2 text-xl font-bold">
            <LineChartIcon className="h-5 w-5 text-primary" aria-hidden="true" />
            {A.title}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {A.subtitle}
          </p>
        </div>
        {inv ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="data-mono flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                {inv.psiCode}
              </span>
              <span className="font-bold text-foreground">{inv.shortName}</span>
              <span>·</span>
              <span>
                {invDatasets.length} {A.datasets.toLowerCase()} · {invDatasets.reduce((a, d) => a + d.series.length, 0)}{" "}
                {A.series.toLowerCase()} · {totalPoints.toLocaleString(lang === "es" ? "es-ES" : "en-US")}{" "}
                {A.points.toLowerCase()}
              </span>
            </div>
            <AiAssistantPanel investigationId={activeInvId} metric={effectiveMetric} seriesIds={visiblePairs.map((p) => p.s.id)} psiCode={inv.psiCode} />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              {t.importData.button}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <AiAssistantPanel investigationId={activeInvId} metric={effectiveMetric} seriesIds={visiblePairs.map((p) => p.s.id)} />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              {t.importData.button}
            </Button>
          </div>
        )}
      </div>

      {/* Selector de investigación (si hay varias con datos analizados) */}
      {invs.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {invs.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setInvId(i.id)}
              aria-pressed={i.id === activeInvId}
              className={`rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${
                i.id === activeInvId
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {i.psiCode} · {i.shortName}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[290px_1fr]">
        {/* Panel lateral: conjuntos y variables */}
        <aside className="space-y-4">
          <div className="hud-panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="display-title text-sm font-bold">{A.datasets}</h3>
              <div className="flex gap-1 text-[10px]">
                <button
                  type="button"
                  className="data-mono rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setEnabledKeys(new Set(invDatasets.map((d) => d.key)))}
                >
                  {A.all}
                </button>
                <button
                  type="button"
                  className="data-mono rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setEnabledKeys(new Set())}
                >
                  {A.none}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {invDatasets.map((d) => {
                const on = enabledKeys?.has(d.key) ?? false;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDataset(d.key)}
                    aria-pressed={on}
                    className={`w-full rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                      on
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/50 bg-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${on ? "bg-primary" : "bg-muted-foreground/40"}`}
                        aria-hidden="true"
                      />
                      {d.tag}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                      {lang === "es" ? d.nameEs : d.nameEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hud-panel p-4">
            <h3 className="display-title mb-2 text-sm font-bold">{A.metric}</h3>
            {metricOrder.length === 0 ? (
              <p className="text-xs text-muted-foreground">{A.noSeries}</p>
            ) : (
              <div className="space-y-1">
                {metricOrder.map((key) => {
                  const on = key === effectiveMetric;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setMetric(key);
                        setHidden(new Set());
                      }}
                      aria-pressed={on}
                      className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                        on
                          ? "border-primary/50 bg-primary/15 font-bold text-primary"
                          : "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      }`}
                    >
                      <span>{metricLabel(key, lang)}</span>
                      <span className="data-mono text-[10px] text-muted-foreground">
                        ×{metricCounts.get(key)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Gráfica y detalle */}
        <section className="space-y-4">
          <div className="hud-panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="data-mono flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
                <span className="display-title text-sm font-bold text-foreground">
                  {effectiveMetric ? metricLabel(effectiveMetric, lang) : "—"}
                </span>
                {xInfo ? (
                  <span>
                    X: {lang === "es" ? xInfo.es : xInfo.en}
                    {unitSuffix(xUnit)} · Y: {yUnit && yUnit !== "-" ? yUnit : "adimensional"}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="analysis-normalized" className="text-xs text-muted-foreground">
                  {A.normalized}
                </Label>
                <Switch
                  id="analysis-normalized"
                  checked={normalized}
                  onCheckedChange={setNormalized}
                  aria-label={A.normalized}
                />
              </div>
            </div>

            {prepared.length === 0 || rows.length === 0 ? (
              <div className="flex h-[340px] flex-col items-center justify-center gap-2 text-center">
                <Activity className="h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">{A.noSeries}</p>
              </div>
            ) : (
              <div style={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={rows} margin={{ top: 8, right: 14, bottom: 4, left: -6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(v: number) => fmtTick(v, xKind)}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      stroke="var(--border)"
                      label={{
                        value: `${lang === "es" ? xInfo?.es : xInfo?.en}${unitSuffix(xUnit)}`,
                        position: "insideBottom",
                        offset: -2,
                        style: { fontSize: 10, fill: "var(--muted-foreground)" },
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      stroke="var(--border)"
                      width={62}
                      tickFormatter={(v: number) => fmtTick(v, xKind)}
                      domain={yDomainMax > 0 ? ["auto", yDomainMax] : undefined}
                      label={
                        normalized
                          ? { value: "%", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "var(--muted-foreground)" } }
                          : {
                              value: yUnit && yUnit !== "-" ? yUnit : "adimensional",
                              angle: -90,
                              position: "insideLeft",
                              style: { fontSize: 10, fill: "var(--muted-foreground)" },
                            }
                      }
                    />
                    <Tooltip
                      content={
                        <AnalyzedTooltip
                          prepared={prepared}
                          lang={lang}
                          xUnit={xUnit}
                          yUnit={yUnit}
                          normalized={normalized}
                          sourceLabels={A.sourceLabels}
                        />
                      }
                      cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
                    />
                    {prepared.map((p) => {
                      // Scatter: solo filas con valor de esta serie (evita puntos
                      // fantasma en las x de otras series); Line: todas + connectNulls
                      const seriesRows =
                        p.meta.source === "EXPERIMENT"
                          ? rows.filter((r) => r[p.key] !== undefined)
                          : rows;
                      return p.meta.source === "EXPERIMENT" ? (
                        <Scatter
                          key={p.meta.id}
                          data={seriesRows}
                          dataKey={p.key}
                          name={multipleDatasets ? `${p.meta.label} · ${p.dataset.tag}` : p.meta.label}
                          fill={p.color}
                          fillOpacity={0.9}
                          isAnimationActive={false}
                          shape={p.hasErr ? makeErrorDotShape(p.color, p.key, p.errKey) : undefined}
                        />
                      ) : (
                        <Line
                          key={p.meta.id}
                          data={seriesRows}
                          dataKey={p.key}
                          name={multipleDatasets ? `${p.meta.label} · ${p.dataset.tag}` : p.meta.label}
                          stroke={p.color}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            <p className="mt-2 text-[10px] leading-snug text-muted-foreground/70">
              {isTime ? A.captionTime : A.captionSweep}
            </p>
          </div>

          {/* Series visibles (leyenda interactiva) */}
          {currentPairs.length > 0 ? (
            <div className="hud-panel p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="display-title text-sm font-bold">
                  {A.series}{" "}
                  <span className="data-mono text-[10px] font-normal text-muted-foreground">
                    ({visiblePairs.length}/{currentPairs.length})
                  </span>
                </h3>
                <div className="flex gap-1 text-[10px]">
                  <button
                    type="button"
                    className="data-mono rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setHidden(new Set())}
                  >
                    {A.all}
                  </button>
                  <button
                    type="button"
                    className="data-mono rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setHidden(new Set(currentPairs.map((p) => p.s.id)))}
                  >
                    {A.none}
                  </button>
                </div>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {currentPairs.map((pair) => {
                  const prep = prepared.find((p) => p.meta.id === pair.s.id);
                  const on = !hidden.has(pair.s.id);
                  const xs = pair.s.points.map((p) => p[0]);
                  return (
                    <button
                      key={pair.s.id}
                      type="button"
                      onClick={() => toggleSeries(pair.s.id)}
                      aria-pressed={on}
                      className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                        on ? "border-border/60 bg-muted/20" : "border-border/30 opacity-50"
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: prep?.color ?? "#888" }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground">
                          {pair.s.label}
                          <span className="ml-1 font-normal text-muted-foreground">· {pair.d.tag}</span>
                        </span>
                        <span className="data-mono block text-[10px] text-muted-foreground">
                          {pair.s.points.length} {A.points} · X [{fmtNum(Math.min(...xs))} … {fmtNum(Math.max(...xs))}] {pair.s.xUnit}
                        </span>
                      </span>
                      <span
                        className={`rounded border px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          SOURCE_STYLES[pair.s.source] ?? "border-border text-muted-foreground"
                        }`}
                      >
                        {A.sourceLabels[pair.s.source] ?? pair.s.source}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Detalle de los conjuntos implicados */}
          <div className="hud-panel p-4">
            <h3 className="display-title mb-2 text-sm font-bold">{A.datasets}</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {[...new Map(visiblePairs.map((p) => [p.d.id, p.d])).values()].map((d) => (
                <div key={d.id} className="rounded-md border border-border/50 bg-muted/10 p-3 text-xs">
                  <p className="font-bold text-foreground">{lang === "es" ? d.nameEs : d.nameEn}</p>
                  <p className="mt-1 text-muted-foreground">
                    <span className="font-semibold">{A.tableFuel}: </span>
                    {d.fuel}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    <span className="font-semibold">{A.tableCondition}: </span>
                    <span className="data-mono">{d.condition}</span>
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    <span className="font-semibold">{A.tableReference}: </span>
                    {d.reference}
                  </p>
                  {d.doi ? (
                    <a
                      href={`https://doi.org/${d.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      className="data-mono mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                    >
                      doi:{d.doi}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={load}
        existingCodes={investigations.map((i) => i.psiCode)}
      />
    </div>
  );
}
