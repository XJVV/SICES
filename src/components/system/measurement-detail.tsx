"use client";

import * as React from "react";
import { Layers, LineChart as LineChartIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/i18n";
import type { Measurement } from "@/lib/types";
import { SourceBadge } from "./badges";
import {
  METRICS,
  ModeSelector,
  OverlayChart,
  TwinChartGrid,
  availableMetrics,
  metricDef,
  metricFullLabel,
  metricLabel,
  pointsStats,
  seriesPoints,
  type ChartMode,
  type MetricKey,
  type SeriesDef,
} from "./series-charts";

interface MeasurementDetailDialogProps {
  measurement: Measurement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** series completas por investigationId (con color estable) */
  seriesMap: Map<number, SeriesDef>;
  /** orden estable de ids para los chips de superposición */
  seriesOrder: number[];
}

function fmtDay(d: string | null): string {
  return d ? d.slice(0, 10) : "N/D";
}

export function MeasurementDetailDialog({
  measurement,
  open,
  onOpenChange,
  seriesMap,
  seriesOrder,
}: MeasurementDetailDialogProps) {
  const { t, lang } = useLanguage();
  const [metric, setMetric] = React.useState<MetricKey>("o2Initial");
  const [overlayIds, setOverlayIds] = React.useState<number[]>([]);
  const [mode, setMode] = React.useState<ChartMode>("auto");
  const [normalized, setNormalized] = React.useState(false);

  const ownSeries = measurement ? seriesMap.get(measurement.investigationId) ?? null : null;

  // Al abrir un registro: métrica por defecto (la primera que tenga el registro) y sin superposición
  React.useEffect(() => {
    if (!open || !measurement) return;
    const first = METRICS.find((m) => measurement[m.key] !== null && measurement[m.key] !== undefined);
    setMetric(first ? first.key : "o2Initial");
    setOverlayIds([]);
    setMode("auto");
    setNormalized(false);
  }, [open, measurement]);

  if (!measurement) return null;

  const visibleSeries: SeriesDef[] = [];
  if (ownSeries) visibleSeries.push(ownSeries);
  for (const id of overlayIds) {
    const s = seriesMap.get(id);
    if (s && s.id !== measurement.investigationId) visibleSeries.push(s);
  }

  // métricas disponibles entre las series visibles
  const metricOptions = METRICS.filter(
    (m) => visibleSeries.some((s) => seriesPoints(s, m.key).length > 0)
  );

  const withMetric = visibleSeries.filter((s) => seriesPoints(s, metric).length > 0);
  const withoutMetric = visibleSeries.filter((s) => seriesPoints(s, metric).length === 0);
  const effectiveMode: "overlay" | "twin" =
    mode === "auto" ? (withoutMetric.length > 0 ? "twin" : "overlay") : mode;

  // tarjetas de valores con posición dentro de la serie del experimento
  const ownPoints = ownSeries ? seriesPoints(ownSeries, metric) : [];
  const ownStats = pointsStats(ownPoints);

  const valueCards = METRICS.filter(
    (m) => measurement[m.key] !== null && measurement[m.key] !== undefined
  ).map((m) => {
    const def = metricDef(m.key);
    const value = (measurement[m.key] as number) * def.scale;
    const pts = ownSeries ? seriesPoints(ownSeries, m.key) : [];
    const stats = pointsStats(pts);
    let pos = 50;
    if (stats && stats.max > stats.min) pos = ((value - stats.min) / (stats.max - stats.min)) * 100;
    else if (stats) pos = 100;
    return { def, value, stats, pos };
  });

  const otherSeries = seriesOrder
    .map((id) => seriesMap.get(id))
    .filter((s): s is SeriesDef => !!s && s.id !== measurement.investigationId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="display-title">{t.recordDetail.title}</span>
            <span className="data-mono text-xs font-normal text-muted-foreground">
              #{measurement.id}
            </span>
            {ownSeries ? (
              <span className="flex items-center gap-1.5 text-sm font-normal">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ownSeries.color }}
                  aria-hidden="true"
                />
                <span className="font-bold">{ownSeries.name}</span>
                <span className="data-mono text-[11px] text-muted-foreground">{ownSeries.psiCode}</span>
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="data-mono">{fmtDay(measurement.date)}</span>
            <span>
              {t.field.fuel}: <span className="data-mono font-semibold">{measurement.fuel || "—"}</span>
            </span>
            <SourceBadge source={measurement.source} />
            {measurement.result ? (
              <span>
                {t.recordDetail.resultLabel}: <span className="italic">{measurement.result}</span>
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Valores del registro con posición en la serie */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="hud-label">{t.recordDetail.valuesTitle}</p>
            </div>
            {valueCards.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.recordDetail.noMetrics}</p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {valueCards.map(({ def, value, stats, pos }) => (
                    <div key={def.key} className="rounded-md border border-border/60 bg-muted/10 p-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">{metricLabel(def, lang)}</span>
                        <span className="data-mono text-sm font-bold">
                          {value.toFixed(def.digits)}{" "}
                          <span className="text-[10px] font-normal text-muted-foreground">{def.unit}</span>
                        </span>
                      </div>
                      <div className="relative mt-2 h-1.5 rounded-full bg-border/70">
                        {stats && stats.max > stats.min ? (
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/30 to-primary/70"
                            style={{ width: `${Math.max(4, pos)}%` }}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span
                          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-[0_0_6px_var(--primary)]"
                          style={{ left: `${Math.min(97, Math.max(3, pos))}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="data-mono mt-1.5 text-[9px] text-muted-foreground/80">
                        {stats
                          ? `${t.recordDetail.min} ${stats.min.toFixed(def.digits)} · ${t.recordDetail.avg} ${stats.avg.toFixed(def.digits)} · ${t.recordDetail.max} ${stats.max.toFixed(def.digits)}`
                          : ""}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground/80">{t.recordDetail.positionNote}</p>
              </>
            )}
          </section>

          {/* Serie del experimento + superposición */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="hud-label">{t.recordDetail.seriesTitle}</p>
            </div>

            {/* Controles */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t.signalLab.metric}</Label>
                <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metricOptions.length > 0 ? (
                      metricOptions.map((m) => (
                        <SelectItem key={m.key} value={m.key}>
                          {metricFullLabel(m.key, lang)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value={metric}>{metricFullLabel(metric, lang)}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.signalLab.mode}</Label>
                <ModeSelector
                  mode={mode}
                  onChange={setMode}
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
                  id="rec-normalize"
                  checked={normalized}
                  onCheckedChange={setNormalized}
                  disabled={effectiveMode === "twin"}
                />
                <Label htmlFor="rec-normalize" className="text-xs">
                  {t.signalLab.normalize}
                </Label>
              </div>
            </div>

            {/* Chips de superposición */}
            <div className="space-y-1.5">
              <p className="hud-label">{t.recordDetail.overlayWith}</p>
              <div className="flex flex-wrap gap-1.5">
                {otherSeries.map((s) => {
                  const active = overlayIds.includes(s.id);
                  const hasMetric = seriesPoints(s, metric).length > 0;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setOverlayIds((prev) =>
                          prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                        )
                      }
                      aria-pressed={active}
                      title={hasMetric ? s.psiCode : `${s.psiCode} — ${t.recordDetail.missing}`}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        active
                          ? "border-primary/60 bg-primary/10 font-semibold text-foreground"
                          : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: s.color, opacity: hasMetric ? 1 : 0.3 }}
                        aria-hidden="true"
                      />
                      {s.name}
                      {!hasMetric ? <span className="text-[9px] uppercase">∅</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gráfica */}
            {ownStats || withMetric.length > 0 ? (
              <>
                {effectiveMode === "overlay" ? (
                  <div className="rounded-md border border-border/60 bg-muted/10 p-3">
                    <p className="hud-label mb-2">{t.signalLab.overlayTitle}</p>
                    <OverlayChart
                      series={visibleSeries}
                      metricKey={metric}
                      normalized={normalized}
                      height={240}
                      highlightRowId={measurement.id}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="hud-label">{t.signalLab.twinTitle}</p>
                    <TwinChartGrid
                      series={visibleSeries}
                      metricKey={metric}
                      height={180}
                      highlightRowId={measurement.id}
                      labels={{
                        missing: t.recordDetail.missing,
                        available: t.recordDetail.available,
                        avg: t.recordDetail.avg,
                        min: t.recordDetail.min,
                        max: t.recordDetail.max,
                        pts: (n) => t.signalLab.points(n),
                      }}
                    />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground/80">{t.recordDetail.highlightNote}</p>
                {withoutMetric.length > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {withoutMetric.map((s) => (
                      <span key={s.id} className="mr-2">
                        <span className="font-semibold">{s.name}</span> {t.recordDetail.missing}.
                      </span>
                    ))}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{t.recordDetail.noMetrics}</p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
