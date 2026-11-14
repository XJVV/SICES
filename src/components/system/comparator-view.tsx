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

export function ComparatorView({ investigations }: ComparatorViewProps) {
  const { t, lang } = useLanguage();
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [allMeasurements, setAllMeasurements] = React.useState<Measurement[] | null>(null);

  // Comparación gráfica de telemetría
  const [chartMetric, setChartMetric] = React.useState<MetricKey>("o2Initial");
  const [chartMode, setChartMode] = React.useState<ChartMode>("auto");
  const [chartNormalized, setChartNormalized] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/measurements?limit=1000&nolog=1")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setAllMeasurements(d.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setAllMeasurements([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    { label: t.field.platform, get: (i) => i.platform || t.common.notAvailable },
    { label: t.field.period, get: (i) => i.period || t.common.notAvailable },
    { label: t.field.investigator, get: (i) => i.investigator || t.common.notAvailable },
    { label: t.field.doi, get: (i) => i.doi || t.common.notAvailable },
    { label: t.field.fuel, get: (i) => i.fuel || t.common.notAvailable },
    { label: t.field.oxygen, get: (i) => i.oxygen || t.common.notAvailable },
    { label: t.field.pressure, get: (i) => i.pressure || t.common.notAvailable },
    { label: t.field.temperature, get: (i) => i.temperature || t.common.notAvailable },
    { label: t.field.flow, get: (i) => i.flow || t.common.notAvailable },
    { label: t.field.results, get: (i) => i.results || t.common.notAvailable },
    { label: t.field.conclusions, get: (i) => i.conclusions || t.common.notAvailable },
  ];

  // Métricas medias por investigación a partir de las mediciones
  const metricsByInv = React.useMemo(() => {
    const map = new Map<number, AvgMetrics>();
    if (!allMeasurements) return map;
    for (const m of allMeasurements) {
      const cur =
        map.get(m.investigationId) ??
        { o2: 0, pressure: 0, temperature: 0, propagation: 0, radiation: 0, count: 0 };
      // acumulamos sumas intermedias reutilizando campos
      map.set(m.investigationId, {
        o2: cur.o2 + (m.o2Initial ?? 0),
        pressure: cur.pressure + (m.pressure ?? 0),
        temperature: cur.temperature + (m.temperature ?? 0),
        propagation: cur.propagation + (m.propagationSpeed ?? 0),
        radiation: cur.radiation + (m.radiation ?? 0),
        count: cur.count + 1,
      });
    }
    // convertir sumas a medias (tratando N/D como 0; suficiente para el radar comparativo)
    for (const [id, v] of map) {
      if (v.count > 0) {
        map.set(id, {
          o2: (v.o2 / v.count) * 100,
          pressure: v.pressure / v.count,
          temperature: v.temperature / v.count,
          propagation: v.propagation / v.count,
          radiation: v.radiation / v.count,
          count: v.count,
        });
      }
    }
    return map;
  }, [allMeasurements]);

  const radarData = React.useMemo(() => {
    const axes: { key: keyof AvgMetrics; label: string }[] = [
      { key: "o2", label: lang === "es" ? "O₂ medio %" : "Avg O₂ %" },
      { key: "pressure", label: lang === "es" ? "Presión atm" : "Pressure atm" },
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
        maxes[axis.key] = Math.max(maxes[axis.key] ?? 0, m[axis.key]);
      }
    }
    return axes.map((axis) => {
      const point: Record<string, string | number> = { axis: axis.label };
      for (const inv of selected) {
        const m = metricsByInv.get(inv.id);
        const raw = m ? m[axis.key] : 0;
        const max = maxes[axis.key] ?? 0;
        point[inv.shortName] = max > 0 ? Number(((raw / max) * 100).toFixed(1)) : 0;
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
