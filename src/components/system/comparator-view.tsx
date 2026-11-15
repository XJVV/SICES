"use client";

import * as React from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { BarChart3, ExternalLink, Radar as RadarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/lib/i18n";
import { useVisualizationMode } from "./visualization-mode";
import { SERIES_PALETTE, type Investigation, type Measurement } from "@/lib/types";
import {
  METRICS,
  ModeSelector,
  OverlayChart,
  TwinChartGrid,
  AvgBarChart,
  metricFullLabel,
  metricLabel,
  seriesPoints,
  type ChartMode,
  type MetricKey,
  type SeriesDef,
} from "./series-charts";

interface ComparatorViewProps {
  investigations: Investigation[];
}

interface AvgMetrics {
  o2: number;
  pressure: number;
  temperature: number;
  propagation: number;
  radiation: number;
  count: number;
}
type NumericRange = {min: number; max: number; count: number} | null;
type ComparisonProfile = {
  id: number; psiCode: string; observations: number; registeredMeasurements: number;
  series: number; sampled: boolean; sourcePaths: string[];
  metrics: Record<"oxygenPercent"|"pressurePsi"|"airflowCmS"|"temperatureC", NumericRange>;
};
type ComparisonResponse = {profiles: ComparisonProfile[]; error?: string};

export function ComparatorView({ investigations }: ComparatorViewProps) {
  const { t, lang } = useLanguage();
  const { mode } = useVisualizationMode();
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [allMeasurements, setAllMeasurements] = React.useState<Measurement[] | null>(null);

  // Comparación gráfica de telemetría
  const [chartMetric, setChartMetric] = React.useState<MetricKey>("o2Initial");
  const [chartMode, setChartMode] = React.useState<ChartMode>("auto");
  const [chartNormalized, setChartNormalized] = React.useState(false);

  const [profiles, setProfiles] = React.useState<ComparisonProfile[]>([]);
  const [comparisonError, setComparisonError] = React.useState("");
  const [chartPartial, setChartPartial] = React.useState(false);
  const selectedKey = selectedIds.join(",");

  // Load each study independently. The former global first-1000-rows request
  // omitted later PSI studies and made valid measurements appear unavailable.
  React.useEffect(() => {
    if (!selectedKey) {
      setAllMeasurements([]); setProfiles([]); setComparisonError(""); setChartPartial(false);
      return;
    }
    const controller = new AbortController();
    const selectedStudies = investigations.filter(i => selectedIds.includes(i.id));
    setAllMeasurements(null); setProfiles([]); setComparisonError("");
    const load = async () => {
      try {
        const [profileResponse, ...measurementResponses] = await Promise.all([
          fetch("/api/compare?ids=" + encodeURIComponent(selectedKey), {signal:controller.signal}),
          ...selectedStudies.map(inv => fetch(
            "/api/measurements?limit=2000&nolog=1&experiment=" + encodeURIComponent(inv.shortName),
            {signal:controller.signal}
          )),
        ]);
        if (!profileResponse.ok || measurementResponses.some(r => !r.ok)) throw Error("API HTTP");
        const profileData = await profileResponse.json() as ComparisonResponse;
        const measurementData = await Promise.all(measurementResponses.map(r=>r.json()));
        if (controller.signal.aborted) return;
        setProfiles(profileData.profiles || []);
        setAllMeasurements(measurementData.flatMap(d => d.rows || []));
        setChartPartial(measurementData.some(d => (d.stats?.total || 0) > (d.rows?.length || 0)));
      } catch (error) {
        if (controller.signal.aborted) return;
        setComparisonError(lang === "es" ? "No se pudo cargar la comparación. Comprueba la base NASA PSI." : "Comparison could not be loaded. Check the NASA PSI database.");
        setProfiles([]); setAllMeasurements([]);
        console.error("Comparator load failed", error);
      }
    };
    void load();
    return () => controller.abort();
  }, [selectedKey, investigations]);

  const profileById = React.useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const missing = lang === "es" ? "No registrado en la fuente" : "Not recorded in the source";
  const textValue = (v: string | null | undefined) => v?.trim() ? v : missing;
  const numericText = (inv: Investigation, key: keyof ComparisonProfile["metrics"], unit: string) => {
    const metric = profileById.get(inv.id)?.metrics[key];
    if (!metric || !metric.count) return missing;
    const fmt = (n: number) => Number(n.toFixed(3)).toLocaleString(lang === "es" ? "es-DO" : "en-US");
    const range = metric.min === metric.max ? fmt(metric.min) : fmt(metric.min) + " – " + fmt(metric.max);
    return range + " " + unit + " (n=" + metric.count + ")";
  };

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectByCodes = (codes: string[]) => {
    setSelectedIds(
      investigations.filter((i) => codes.includes(i.psiCode)).map((i) => i.id)
    );
  };

  const selected = investigations.filter((i) => selectedIds.includes(i.id));

  const rows: { label: string; get: (inv: Investigation) => string }[] = [
    { label: t.field.psiCode, get: (i) => i.psiCode },
    { label: t.field.name, get: (i) => i.name },
    { label: t.field.category, get: (i) => t.categoryLabel[i.category] ?? i.category },
    { label: t.field.combustionType, get: (i) => t.combustionFull[i.combustionType] ?? i.combustionType },
    { label: t.field.platform, get: (i) => textValue(i.platform) },
    { label: t.field.period, get: (i) => textValue(i.period) },
    { label: t.field.investigator, get: (i) => textValue(i.investigator) },
    { label: t.field.doi, get: (i) => textValue(i.doi) },
    { label: t.field.fuel, get: (i) => textValue(i.fuel) },
    { label: t.field.oxygen, get: (i) => numericText(i, "oxygenPercent", "%") },
    { label: t.field.pressure, get: (i) => numericText(i, "pressurePsi", "psi") },
    { label: t.field.temperature, get: (i) => numericText(i, "temperatureC", "°C") },
    { label: t.field.flow, get: (i) => numericText(i, "airflowCmS", "cm/s") },
    { label: t.field.results, get: (i) => textValue(i.results) },
    { label: t.field.conclusions, get: (i) => textValue(i.conclusions) },
    { label: lang === "es" ? "Observaciones NASA PSI" : "NASA PSI observations", get: (i) => String(profileById.get(i.id)?.observations ?? 0) },
    { label: lang === "es" ? "Curvas experimentales" : "Experimental curves", get: (i) => String(profileById.get(i.id)?.series ?? 0) },
    { label: lang === "es" ? "Archivos de procedencia" : "Source files", get: (i) => profileById.get(i.id)?.sourcePaths?.join("; ") || missing },
  ];

  // Per-metric averages exclude missing values instead of silently adding zero.
  const metricsByInv = React.useMemo(() => {
    const map = new Map<number, AvgMetrics>();
    if (!allMeasurements) return map;
    const keys = ["o2", "pressure", "temperature", "propagation", "radiation"] as const;
    const sums = new Map<number, Record<typeof keys[number], {sum:number; count:number}>>();
    for (const m of allMeasurements) {
      const current = sums.get(m.investigationId) ?? {
        o2:{sum:0,count:0}, pressure:{sum:0,count:0}, temperature:{sum:0,count:0},
        propagation:{sum:0,count:0}, radiation:{sum:0,count:0},
      };
      const values = {
        o2:m.o2Initial === null ? null : m.o2Initial * 100,
        pressure:m.pressure === null ? null : m.pressure * 14.6959487755,
        temperature:m.temperature, propagation:m.propagationSpeed, radiation:m.radiation,
      };
      for (const k of keys) {
        const value = values[k];
        if (value !== null && Number.isFinite(value)) {
          current[k].sum += value; current[k].count++;
        }
      }
      sums.set(m.investigationId,current);
    }
    for (const [id, values] of sums) {
      const avg = (k:typeof keys[number]) => values[k].count ? values[k].sum / values[k].count : NaN;
      map.set(id,{o2:avg("o2"),pressure:avg("pressure"),temperature:avg("temperature"),
        propagation:avg("propagation"),radiation:avg("radiation"),
        count:Math.max(...keys.map(k => values[k].count))});
    }
    return map;
  }, [allMeasurements]);

  const radarData = React.useMemo(() => {
    const axes: { key: keyof AvgMetrics; label: string }[] = [
      { key: "o2", label: lang === "es" ? "O₂ medio %" : "Avg O₂ %" },
      { key: "pressure", label: lang === "es" ? "Presión psi" : "Pressure psi" },
      { key: "temperature", label: lang === "es" ? "Temp °C" : "Temp °C" },
      { key: "propagation", label: lang === "es" ? "Vel. prop. cm/s" : "Spread cm/s" },
      { key: "radiation", label: lang === "es" ? "Radiación W/cm²" : "Radiation W/cm²" },
      { key: "count", label: lang === "es" ? "Nº mediciones" : "Measurements" },
    ];
    // normalizar por máximo entre seleccionadas
    const maxes: Partial<Record<keyof AvgMetrics, number>> = {};
    for (const inv of selected) {
      const m = metricsByInv.get(inv.id);
      if (!m) continue;
      for (const axis of axes) {
        if (Number.isFinite(m[axis.key])) maxes[axis.key] = Math.max(maxes[axis.key] ?? 0, m[axis.key]);
      }
    }
    return axes.map((axis) => {
      const point: Record<string, string | number | null> = { axis: axis.label };
      for (const inv of selected) {
        const m = metricsByInv.get(inv.id);
        const raw = m ? m[axis.key] : NaN;
        const max = maxes[axis.key] ?? 0;
        point[inv.shortName] = max > 0 && Number.isFinite(raw) ? Number(((raw / max) * 100).toFixed(1)) : null;
      }
      return point;
    });
  }, [selected, metricsByInv, lang]);

  const hasMeasurements = selected.some((inv) => (metricsByInv.get(inv.id)?.count ?? 0) > 0);

  /* ---------- Comparación gráfica: series por investigación seleccionada ---------- */

  const selectedSeries = React.useMemo<SeriesDef[]>(() => {
    if (!allMeasurements) return [];
    return selected.map((inv, i) => ({
      id: inv.id,
      name: inv.shortName,
      psiCode: inv.psiCode,
      color: SERIES_PALETTE[i % SERIES_PALETTE.length],
      rows: allMeasurements
        .filter((m) => m.investigationId === inv.id)
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    }));
  }, [selected, allMeasurements]);

  const chartWithoutMetric = selectedSeries.filter((s) => seriesPoints(s, chartMetric).length === 0);
  const chartEffectiveMode: "overlay" | "twin" =
    chartMode === "auto" ? (chartWithoutMetric.length > 0 ? "twin" : "overlay") : chartMode;

  const chartMetricOptions = React.useMemo(
    () => METRICS.filter((m) => selectedSeries.some((s) => seriesPoints(s, m.key).length > 0)),
    [selectedSeries]
  );
  const chartMetricOptionsStr = chartMetricOptions.map((m) => m.key).join(",");
  React.useEffect(() => {
    if (chartMetricOptionsStr && !chartMetricOptionsStr.split(",").includes(chartMetric)) {
      setChartMetric(chartMetricOptionsStr.split(",")[0] as MetricKey);
    }
  }, [chartMetricOptionsStr, chartMetric]);

  const tooltipStyle = {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--hud-border)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "var(--popover-foreground)",
    backdropFilter: "blur(8px)",
  };

  if (mode === "educational") {
    return <section className="space-y-5">
      <header className="hud-panel p-6">
        <h2 className="text-xl font-bold">⚖️ ¡Duelo de experimentos espaciales!</h2>
        <p className="mt-2 text-sm">Elige investigaciones de NASA para conocer qué estudió cada una. No hay una competencia: cada experimento responde preguntas diferentes.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={()=>selectByCodes(["PSI-26","PSI-25"])}>BASS y BASS-II</Button>
          <Button variant="outline" size="sm" onClick={()=>selectByCodes(["PSI-98","PSI-99"])}>Saffire I y II</Button>
          <Button variant="outline" size="sm" onClick={()=>selectByCodes(["PSI-102","PSI-101"])}>SAME y SAME-R</Button>
          <Button variant="outline" size="sm" onClick={()=>selectByCodes(["PSI-69","PSI-68"])}>FLEX y FLEX-2</Button>
        </div>
      </header>
      <div className="hud-panel p-5">
        <h3 className="font-bold">También puedes elegir uno a uno:</h3>
        <div className="mt-3 flex flex-wrap gap-2">{investigations.map(i=><Button key={i.id} variant={selectedIds.includes(i.id)?"default":"outline"} size="sm" onClick={()=>setSelectedIds(prev=>prev.includes(i.id)?prev.filter(v=>v!==i.id):[...prev.slice(-2),i.id])}>{i.shortName}</Button>)}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">{selected.map(i=><article key={i.id} className="hud-panel p-5">
        <p className="text-xs font-bold text-primary">{i.psiCode} · {i.agency || "NASA PSI"}</p>
        <h3 className="mt-1 text-lg font-bold">{i.shortName}</h3>
        <p className="mt-3 text-sm leading-relaxed">{i.laymanSummary || "No hay un resumen sencillo comprobado."}</p>
        <p className="mt-3 text-sm">¿Qué aprende la tripulación? {i.safetyDomain === "PREVENTION" ? "Cómo evitar que se propague un fuego." : i.safetyDomain === "DETECTION" ? "Cómo reconocer el humo." : i.safetyDomain === "SUPPRESSION" ? "Cómo apagar llamas." : "Cómo se comporta el fuego."}</p>
      </article>)}</div>
      {!selected.length&&<p className="text-sm text-muted-foreground">Selecciona dos experimentos para comenzar.</p>}
      <p className="text-xs text-muted-foreground">El modo Científico muestra una comparación completa con variables, datos y gráficos.</p>
    </section>;
  }

  return (
    <div className="animate-fade-up grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Panel de selección */}
      <div className="hud-panel h-fit p-5">
        <h2 className="display-title text-lg font-bold">{t.comparator.title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.comparator.description}</p>

        <div className="mt-4 space-y-2">
          <p className="hud-label">{t.comparator.presets}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => selectByCodes(["PSI-26", "PSI-25"])}>
              {t.comparator.presetBass}
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectByCodes(["PSI-98", "PSI-99", "PSI-100"])}>
              {t.comparator.presetSaffire}
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectByCodes(["PSI-102", "PSI-101"])}>
              {t.comparator.presetSame}
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectByCodes(["PSI-69", "PSI-68"])}>
              {t.comparator.presetFlex}
            </Button>
            {selectedIds.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                <X className="h-4 w-4" aria-hidden="true" />
                {t.common.clear}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <p className="hud-label">{t.comparator.selection}</p>
          <div className="max-h-80 overflow-y-auto rounded-md border border-border/60 p-2">
            <div className="space-y-1">
              {investigations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-start gap-2 rounded px-2 py-1.5 transition-colors hover:bg-primary/5"
                >
                  <Checkbox
                    id={`cmp-${inv.id}`}
                    checked={selectedIds.includes(inv.id)}
                    onCheckedChange={() => toggle(inv.id)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`cmp-${inv.id}`}
                    className="cursor-pointer text-sm font-normal leading-snug"
                  >
                    <span className="data-mono text-xs text-muted-foreground">{inv.psiCode}</span>{" "}
                    {inv.shortName}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <p className="data-mono text-xs text-muted-foreground">
            {selectedIds.length} {t.common.selected}
          </p>
        </div>
      </div>

      {/* Resultado */}
      <div className="space-y-4">
        {selected.length === 0 ? (
          <div className="hud-panel flex h-64 flex-col items-center justify-center gap-3 p-8 text-center">
            <RadarIcon className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t.comparator.empty}</p>
          </div>
        ) : (
          <>
            {comparisonError ? <p role="alert" className="hud-panel p-4 text-sm text-amber-300">{comparisonError}</p> : null}
            {allMeasurements === null ? <p role="status" className="hud-panel p-4 text-sm">{lang === "es" ? "Cargando registros por investigación…" : "Loading records by study…"}</p> : null}
            {chartPartial ? <p role="status" className="hud-panel p-4 text-xs text-amber-300">{lang === "es" ? "Hay más de 2,000 mediciones en alguna investigación. Las gráficas muestran una muestra limitada; consulta el observatorio para los registros completos." : "At least one study exceeds 2,000 measurements. Charts show a limited sample; see the observatory for full records."}</p> : null}
            {profiles.some(p => p.sampled) ? <p className="hud-panel p-4 text-xs text-amber-300">{lang === "es" ? "Algunos rangos usan un subconjunto de registros, marcado como muestra. No se han estimado puntos faltantes." : "Some ranges use a subset of source records. Missing points have not been estimated."}</p> : null}
            {/* Radar de métricas */}
            {hasMeasurements ? (
              <div className="hud-panel p-5">
                <div className="mb-3 flex items-center gap-2">
                  <RadarIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <p className="hud-label">{t.comparator.radarTitle}</p>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius="72%">
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} angle={90} />
                      <Tooltip contentStyle={tooltipStyle} />
                      {selected.map((inv, i) => (
                        <Radar
                          key={inv.id}
                          name={inv.shortName}
                          dataKey={inv.shortName}
                          stroke={SERIES_PALETTE[i % SERIES_PALETTE.length]}
                          fill={SERIES_PALETTE[i % SERIES_PALETTE.length]}
                          fillOpacity={0.18}
                          strokeWidth={2}
                        />
                      ))}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-center text-[11px] text-muted-foreground">
                  {t.comparator.radarNote}
                </p>
              </div>
            ) : null}

            {/* Comparación gráfica de telemetría */}
            {chartMetricOptions.length > 0 ? (
              <div className="hud-panel p-5">
                <div className="mb-1 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
                  <p className="hud-label">{t.comparator.chartsTitle}</p>
                </div>
                <p className="mb-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  {t.comparator.chartsDescription}
                </p>

                {/* Chips de métricas con cobertura */}
                <div className="flex flex-wrap gap-1.5">
                  {chartMetricOptions.map((m) => {
                    const active = m.key === chartMetric;
                    const cover = selectedSeries.filter((s) => seriesPoints(s, m.key).length > 0).length;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setChartMetric(m.key)}
                        aria-pressed={active}
                        title={`${cover}/${selectedSeries.length} ${t.comparator.metricCoverage}`}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                          active
                            ? "border-primary/60 bg-primary/10 font-semibold text-foreground"
                            : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {metricLabel(m, lang)}
                        <span
                          className={`data-mono text-[9px] ${
                            cover === selectedSeries.length ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {cover}/{selectedSeries.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Controles */}
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t.signalLab.mode}</Label>
                    <ModeSelector
                      mode={chartMode}
                      onChange={setChartMode}
                      labels={{
                        mode: t.signalLab.mode,
                        auto: t.signalLab.modeAuto,
                        overlay: t.signalLab.modeOverlay,
                        twin: t.signalLab.modeTwin,
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-1">
                    <Switch
                      id="cmp-normalize"
                      checked={chartNormalized}
                      onCheckedChange={setChartNormalized}
                      disabled={chartEffectiveMode === "twin"}
                    />
                    <Label htmlFor="cmp-normalize" className="text-xs" title={t.signalLab.normalizeHint}>
                      {t.signalLab.normalize}
                    </Label>
                  </div>
                </div>

                {/* Gráfica de series */}
                {chartEffectiveMode === "overlay" ? (
                  <div className="mt-3 rounded-md border border-border/60 bg-muted/10 p-3">
                    <p className="hud-label mb-2">
                      {t.signalLab.overlayTitle} · {metricFullLabel(chartMetric, lang)}
                    </p>
                    <OverlayChart
                      series={selectedSeries}
                      metricKey={chartMetric}
                      normalized={chartNormalized}
                      height={260}
                    />
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="hud-label">
                      {t.signalLab.twinTitle} · {metricFullLabel(chartMetric, lang)}
                    </p>
                    <TwinChartGrid
                      series={selectedSeries}
                      metricKey={chartMetric}
                      height={180}
                      labels={{
                        missing: t.comparator.withoutMetric,
                        available: t.signalLab.available,
                        avg: t.signalLab.avg,
                        min: t.signalLab.min,
                        max: t.signalLab.max,
                        pts: (n) => t.signalLab.points(n),
                      }}
                    />
                  </div>
                )}

                {/* Media por experimento */}
                <div className="mt-4 rounded-md border border-border/60 bg-muted/10 p-3">
                  <p className="hud-label mb-2">
                    {t.comparator.avgTitle} · {metricFullLabel(chartMetric, lang)}
                  </p>
                  <AvgBarChart series={selectedSeries} metricKey={chartMetric} />
                </div>

                {chartWithoutMetric.length > 0 ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {chartWithoutMetric.map((s) => (
                      <span key={s.id} className="mr-2">
                        <span className="font-semibold">{s.name}</span> {t.comparator.withoutMetric}.
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            ) : hasMeasurements ? null : (
              <div className="hud-panel p-5">
                <p className="text-xs text-muted-foreground">{t.comparator.chartsEmpty}</p>
              </div>
            )}

            {/* Tabla comparativa */}
            <div className="hud-panel overflow-hidden">
              <div className="table-head-scan border-b border-border/60 px-5 py-3">
                <span className="hud-label">{t.comparator.tableCaption}</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="sticky left-0 z-10 w-44 bg-background/95 backdrop-blur">
                        {t.field.investigation}
                      </TableHead>
                      {selected.map((inv) => (
                        <TableHead key={inv.id} className="min-w-64 align-top">
                          <div className="space-y-1">
                            <span className="display-title block text-sm font-bold">{inv.shortName}</span>
                            <span className="data-mono block text-[11px] font-normal text-muted-foreground">
                              {inv.psiCode}
                            </span>
                            {inv.psiUrl ? (
                              <a
                                href={inv.psiUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-normal text-primary hover:underline"
                              >
                                {t.common.openPsiShort}
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            ) : null}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.label}>
                        <TableCell className="sticky left-0 z-10 bg-background/95 text-xs font-semibold backdrop-blur">
                          {row.label}
                        </TableCell>
                        {selected.map((inv) => (
                          <TableCell key={inv.id} className="text-sm align-top">
                            {row.get(inv)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
