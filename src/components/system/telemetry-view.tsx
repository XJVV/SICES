"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  Activity,
  Download,
  Eye,
  FileText,
  FilterX,
  History,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAuth } from "./auth";
import { SourceBadge } from "./badges";
import { MeasurementDetailDialog } from "./measurement-detail";
import {
  METRICS,
  ModeSelector,
  OverlayChart,
  TwinChartGrid,
  metricFullLabel,
  seriesPoints,
  type ChartMode,
  type MetricKey,
  type SeriesDef,
} from "./series-charts";
import {
  SERIES_PALETTE,
  CHART_COLORS,
  type CombustionType,
  type Measurement,
  type MeasurementsResponse,
  type CatalogResponse,
  type MeasurementFiltersState,
  type QueryHistoryItem,
} from "@/lib/types";

const EMPTY_FILTERS: MeasurementFiltersState = {};

function buildQuery(f: MeasurementFiltersState): string {
  const p = new URLSearchParams();
  if (f.experiment) p.set("experiment", f.experiment);
  if (f.fuel) p.set("fuel", f.fuel);
  if (f.oxygenMin !== undefined) p.set("oxygenMin", String(f.oxygenMin));
  if (f.oxygenMax !== undefined) p.set("oxygenMax", String(f.oxygenMax));
  if (f.pressureMin !== undefined) p.set("pressureMin", String(f.pressureMin));
  if (f.pressureMax !== undefined) p.set("pressureMax", String(f.pressureMax));
  if (f.temperatureMin !== undefined) p.set("temperatureMin", String(f.temperatureMin));
  if (f.temperatureMax !== undefined) p.set("temperatureMax", String(f.temperatureMax));
  if (f.dateFrom) p.set("dateFrom", f.dateFrom);
  if (f.dateTo) p.set("dateTo", f.dateTo);
  p.set("limit", "300");
  return p.toString();
}

const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "N/D" : `${(v * 100).toFixed(digits)}%`;
const num = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined ? "N/D" : v.toFixed(digits);
const dateStr = (d: string | null | undefined) => (d ? d.slice(0, 10) : "N/D");

export function TelemetryView() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  const [filters, setFilters] = React.useState<MeasurementFiltersState>(EMPTY_FILTERS);
  const [applied, setApplied] = React.useState<MeasurementFiltersState>(EMPTY_FILTERS);
  const [data, setData] = React.useState<MeasurementsResponse | null>(null);
  const [catalog, setCatalog] = React.useState<CatalogResponse | null>(null);
  const [history, setHistory] = React.useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);

  // Datos completos para el explorador de series y el detalle de registros (sin históric)
  const [allRows, setAllRows] = React.useState<Measurement[] | null>(null);

  // Explorador de series
  const [labSelected, setLabSelected] = React.useState<number[]>([]);
  const [labMetric, setLabMetric] = React.useState<MetricKey>("o2Initial");
  const [labMode, setLabMode] = React.useState<ChartMode>("auto");
  const [labNormalized, setLabNormalized] = React.useState(false);

  // Diálogo de detalle de registro
  const [detailMeasurement, setDetailMeasurement] = React.useState<Measurement | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Campos de entrada (texto libre → número)
  const [oxygenMin, setOxygenMin] = React.useState("");
  const [oxygenMax, setOxygenMax] = React.useState("");
  const [pressureMin, setPressureMin] = React.useState("");
  const [pressureMax, setPressureMax] = React.useState("");
  const [temperatureMin, setTemperatureMin] = React.useState("");
  const [temperatureMax, setTemperatureMax] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  React.useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then(setCatalog)
      .catch(() => undefined);
    fetch("/api/measurements?limit=2000&nolog=1")
      .then((r) => r.json())
      .then((d) => setAllRows(d.rows ?? []))
      .catch(() => setAllRows([]));
  }, []);

  const load = React.useCallback(async (f: MeasurementFiltersState) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/measurements?${buildQuery(f)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(true);
        setData(null);
        return;
      }
      setData(json);
      setShowAll(false);
      if (user) {
        fetch("/api/history")
          .then((r) => r.json())
          .then((h) => setHistory(h.history ?? []))
          .catch(() => undefined);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    load(EMPTY_FILTERS);
  }, [load]);

  const applyFilters = () => {
    const f: MeasurementFiltersState = {};
    if (filters.experiment) f.experiment = filters.experiment;
    if (filters.fuel) f.fuel = filters.fuel;
    const toNum = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));
    const om = toNum(oxygenMin);
    const oM = toNum(oxygenMax);
    const pm = toNum(pressureMin);
    const pM = toNum(pressureMax);
    const tm = toNum(temperatureMin);
    const tM = toNum(temperatureMax);
    if (om !== undefined && !Number.isNaN(om)) f.oxygenMin = om;
    if (oM !== undefined && !Number.isNaN(oM)) f.oxygenMax = oM;
    if (pm !== undefined && !Number.isNaN(pm)) f.pressureMin = pm;
    if (pM !== undefined && !Number.isNaN(pM)) f.pressureMax = pM;
    if (tm !== undefined && !Number.isNaN(tm)) f.temperatureMin = tm;
    if (tM !== undefined && !Number.isNaN(tM)) f.temperatureMax = tM;
    if (dateFrom) f.dateFrom = dateFrom;
    if (dateTo) f.dateTo = dateTo;
    setFilters(f);
    setApplied(f);
    load(f);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setOxygenMin("");
    setOxygenMax("");
    setPressureMin("");
    setPressureMax("");
    setTemperatureMin("");
    setTemperatureMax("");
    setDateFrom("");
    setDateTo("");
    load(EMPTY_FILTERS);
  };

  const applyHistoryItem = (item: QueryHistoryItem) => {
    const f = item.filters ?? {};
    setFilters(f);
    setApplied(f);
    setOxygenMin(f.oxygenMin !== undefined ? String(f.oxygenMin) : "");
    setOxygenMax(f.oxygenMax !== undefined ? String(f.oxygenMax) : "");
    setPressureMin(f.pressureMin !== undefined ? String(f.pressureMin) : "");
    setPressureMax(f.pressureMax !== undefined ? String(f.pressureMax) : "");
    setTemperatureMin(f.temperatureMin !== undefined ? String(f.temperatureMin) : "");
    setTemperatureMax(f.temperatureMax !== undefined ? String(f.temperatureMax) : "");
    setDateFrom(f.dateFrom ?? "");
    setDateTo(f.dateTo ?? "");
    load(f);
  };

  const rows = data?.rows ?? [];
  const stats = data?.stats;
  const visibleRows = showAll ? rows : rows.slice(0, 60);

  // Datos para gráficos
  const lineData = rows.map((r, i) => ({
    idx: i + 1,
    propagation: r.propagationSpeed,
    radiation: r.radiation,
    experiment: r.investigation?.shortName ?? "",
  }));
  const scatterData = rows
    .filter((r) => r.o2Initial !== null && r.propagationSpeed !== null)
    .map((r) => ({
      x: (r.o2Initial ?? 0) * 100,
      y: r.propagationSpeed ?? 0,
      experiment: r.investigation?.shortName ?? "",
      fuel: r.fuel,
    }));
  const scatterGroups = React.useMemo(() => {
    const groups = new Map<string, typeof scatterData>();
    for (const p of scatterData) {
      const arr = groups.get(p.experiment) ?? [];
      arr.push(p);
      groups.set(p.experiment, arr);
    }
    return [...groups.entries()];
  }, [scatterData]);

  const axisStyle = { fontSize: 10, fill: "var(--muted-foreground)" };
  const tooltipStyle = {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--hud-border)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "var(--popover-foreground)",
    backdropFilter: "blur(8px)",
  };

  const experimentsWithMeasurements = (catalog?.investigations ?? []).filter(
    (i) => i._count.measurements > 0
  );

  /* ---------- Explorador de series ---------- */

  const seriesMap = React.useMemo(() => {
    const map = new Map<number, SeriesDef>();
    if (!allRows || !catalog) return map;
    experimentsWithMeasurements.forEach((inv, idx) => {
      const rows = allRows
        .filter((r) => r.investigationId === inv.id)
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
      map.set(inv.id, {
        id: inv.id,
        name: inv.shortName,
        psiCode: inv.psiCode,
        color: SERIES_PALETTE[idx % SERIES_PALETTE.length],
        rows,
      });
    });
    return map;
  }, [allRows, catalog]);

  const seriesOrder = React.useMemo(() => [...seriesMap.keys()], [seriesMap]);

  // selección por defecto: la pareja comparable con menor código PSI (p. ej. BASS-II + BASS)
  React.useEffect(() => {
    if (seriesOrder.length > 1 && labSelected.length === 0) {
      const preferred = [...seriesMap.values()]
        .sort((a, b) => {
          const na = parseInt(a.psiCode.replace(/\D+/g, ""), 10);
          const nb = parseInt(b.psiCode.replace(/\D+/g, ""), 10);
          return (Number.isNaN(na) ? 9999 : na) - (Number.isNaN(nb) ? 9999 : nb);
        })
        .slice(0, 2)
        .map((s) => s.id);
      setLabSelected(preferred);
    }
  }, [seriesOrder, seriesMap, labSelected.length]);

  const toggleLab = (id: number) =>
    setLabSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const labSeries = labSelected
    .map((id) => seriesMap.get(id))
    .filter((s): s is SeriesDef => !!s);
  const labWithoutMetric = labSeries.filter((s) => seriesPoints(s, labMetric).length === 0);
  const labEffectiveMode: "overlay" | "twin" =
    labMode === "auto" ? (labWithoutMetric.length > 0 ? "twin" : "overlay") : labMode;

  const labMetricOptions = React.useMemo(
    () => METRICS.filter((m) => labSeries.some((s) => seriesPoints(s, m.key).length > 0)),
    [labSeries]
  );
  const labMetricOptionsStr = labMetricOptions.map((m) => m.key).join(",");
  React.useEffect(() => {
    if (labMetricOptionsStr && !labMetricOptionsStr.split(",").includes(labMetric)) {
      setLabMetric(labMetricOptionsStr.split(",")[0] as MetricKey);
    }
  }, [labMetricOptionsStr, labMetric]);

  const openDetail = (r: Measurement) => {
    setDetailMeasurement(r);
    setDetailOpen(true);
  };

  return (
    <div className="animate-fade-up space-y-6">
      {/* Encabezado */}
      <div>
        <h2 className="display-title text-xl font-bold">{t.telemetryView.title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t.telemetryView.description}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {/* Consola de filtros */}
        <div className="hud-panel h-fit p-4 xl:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="hud-label">{t.telemetryView.filtersTitle}</span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t.telemetryView.experiment}</Label>
              <Select
                value={filters.experiment ?? "all"}
                onValueChange={(v) => setFilters((f) => ({ ...f, experiment: v === "all" ? undefined : v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.common.all}</SelectItem>
                  {experimentsWithMeasurements.map((i) => (
                    <SelectItem key={i.id} value={i.shortName}>
                      {i.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t.telemetryView.fuel}</Label>
              <Select
                value={filters.fuel ?? "all"}
                onValueChange={(v) => setFilters((f) => ({ ...f, fuel: v === "all" ? undefined : v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.common.all}</SelectItem>
                  {(catalog?.fuels ?? [])
                    .filter((f) => f.measurementsCount > 0)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.name}>
                        {f.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t.telemetryView.oxygenRange}</Label>
              <div className="flex items-center gap-2">
                <Input
                  className="input-terminal"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder={t.telemetryView.min}
                  value={oxygenMin}
                  onChange={(e) => setOxygenMin(e.target.value)}
                  aria-label={`${t.telemetryView.oxygenRange} ${t.telemetryView.min}`}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  className="input-terminal"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder={t.telemetryView.max}
                  value={oxygenMax}
                  onChange={(e) => setOxygenMax(e.target.value)}
                  aria-label={`${t.telemetryView.oxygenRange} ${t.telemetryView.max}`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t.telemetryView.pressureRange}</Label>
              <div className="flex items-center gap-2">
                <Input
                  className="input-terminal"
                  type="number"
                  step="0.1"
                  placeholder={t.telemetryView.min}
                  value={pressureMin}
                  onChange={(e) => setPressureMin(e.target.value)}
                  aria-label={`${t.telemetryView.pressureRange} ${t.telemetryView.min}`}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  className="input-terminal"
                  type="number"
                  step="0.1"
                  placeholder={t.telemetryView.max}
                  value={pressureMax}
                  onChange={(e) => setPressureMax(e.target.value)}
                  aria-label={`${t.telemetryView.pressureRange} ${t.telemetryView.max}`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t.telemetryView.temperatureRange}</Label>
              <div className="flex items-center gap-2">
                <Input
                  className="input-terminal"
                  type="number"
                  step="1"
                  placeholder={t.telemetryView.min}
                  value={temperatureMin}
                  onChange={(e) => setTemperatureMin(e.target.value)}
                  aria-label={`${t.telemetryView.temperatureRange} ${t.telemetryView.min}`}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  className="input-terminal"
                  type="number"
                  step="1"
                  placeholder={t.telemetryView.max}
                  value={temperatureMax}
                  onChange={(e) => setTemperatureMax(e.target.value)}
                  aria-label={`${t.telemetryView.temperatureRange} ${t.telemetryView.max}`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t.telemetryView.dateRange}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  className="input-terminal"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label={t.telemetryView.from}
                />
                <Input
                  className="input-terminal"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label={t.telemetryView.to}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={applyFilters} className="glow-primary flex-1" disabled={loading}>
                <Search className="h-4 w-4" aria-hidden="true" />
                {loading ? t.common.loading : t.telemetryView.apply}
              </Button>
              <Button variant="outline" onClick={clearFilters} aria-label={t.telemetryView.clear}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {/* Exportaciones */}
            <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={`/api/export/measurements?${buildQuery(applied)}`} download>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.telemetryView.exportCsv}
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={`/api/export/report?${buildQuery(applied)}`} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.telemetryView.exportPdf}
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="space-y-4 xl:col-span-3">
          {/* Métricas */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="hud-panel stat-card p-3">
              <span className="hud-label leading-tight">{t.telemetryView.statsRecords}</span>
              <p className="data-mono mt-1.5 text-2xl font-bold">{stats?.total ?? 0}</p>
            </div>
            <div className="hud-panel stat-card p-3">
              <span className="hud-label leading-tight">{t.telemetryView.statsExperiments}</span>
              <p className="data-mono mt-1.5 text-2xl font-bold">{stats?.byExperiment.length ?? 0}</p>
            </div>
            <div className="hud-panel stat-card p-3">
              <span className="hud-label leading-tight">{t.telemetryView.statsO2Range}</span>
              <p className="data-mono mt-1.5 text-sm font-bold leading-7">
                {pct(stats?.o2InitialMin)} – {pct(stats?.o2InitialMax)}
              </p>
            </div>
            <div className="hud-panel stat-card p-3">
              <span className="hud-label leading-tight">{t.telemetryView.statsPropagation}</span>
              <p className="data-mono mt-1.5 text-sm font-bold leading-7">
                {num(stats?.propagationMin)} – {num(stats?.propagationMax)} cm/s
              </p>
            </div>
          </div>

          {/* Explorador de series */}
          <div className="hud-panel p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Waves className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="hud-label">{t.signalLab.title}</p>
              <span className="data-mono rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                {t.signalLab.badge}
              </span>
            </div>
            <p className="mb-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              {t.signalLab.description}
            </p>

            {/* Chips de experimentos */}
            <div className="space-y-1.5">
              <p className="hud-label">{t.signalLab.experiments}</p>
              <div className="flex flex-wrap gap-1.5">
                {seriesOrder.map((id) => {
                  const s = seriesMap.get(id);
                  if (!s) return null;
                  const active = labSelected.includes(id);
                  const hasMetric = seriesPoints(s, labMetric).length > 0;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleLab(id)}
                      aria-pressed={active}
                      title={hasMetric ? s.psiCode : `${s.psiCode} — ${t.signalLab.missing}`}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        active
                          ? "border-primary/60 bg-primary/10 font-semibold text-foreground"
                          : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: s.color, opacity: active && !hasMetric ? 0.35 : 1 }}
                        aria-hidden="true"
                      />
                      {s.name}
                      {active && !hasMetric ? (
                        <span className="data-mono text-[9px] text-muted-foreground/70" aria-hidden="true">
                          ∅
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Controles */}
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t.signalLab.metric}</Label>
                <Select value={labMetric} onValueChange={(v) => setLabMetric(v as MetricKey)}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {labMetricOptions.map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {metricFullLabel(m.key, lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.signalLab.mode}</Label>
                <ModeSelector
                  mode={labMode}
                  onChange={setLabMode}
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
                  id="lab-normalize"
                  checked={labNormalized}
                  onCheckedChange={setLabNormalized}
                  disabled={labEffectiveMode === "twin"}
                />
                <Label htmlFor="lab-normalize" className="text-xs" title={t.signalLab.normalizeHint}>
                  {t.signalLab.normalize}
                </Label>
              </div>
            </div>
            {labMode === "auto" ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground/80">{t.signalLab.autoHint}</p>
            ) : null}

            {/* Gráfica del explorador */}
            {labSeries.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">{t.signalLab.noExperiments}</p>
            ) : labEffectiveMode === "overlay" ? (
              <div className="mt-3 rounded-md border border-border/60 bg-muted/10 p-3">
                <p className="hud-label mb-2">
                  {t.signalLab.overlayTitle} · {metricFullLabel(labMetric, lang)}
                </p>
                <OverlayChart
                  series={labSeries}
                  metricKey={labMetric}
                  normalized={labNormalized}
                  height={280}
                />
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="hud-label">
                  {t.signalLab.twinTitle} · {metricFullLabel(labMetric, lang)}
                </p>
                <TwinChartGrid
                  series={labSeries}
                  metricKey={labMetric}
                  height={190}
                  labels={{
                    missing: t.signalLab.missing,
                    available: t.signalLab.available,
                    avg: t.signalLab.avg,
                    min: t.signalLab.min,
                    max: t.signalLab.max,
                    pts: (n) => t.signalLab.points(n),
                  }}
                />
                {labWithoutMetric.length > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {labWithoutMetric.map((s) => (
                      <span key={s.id} className="mr-2">
                        <span className="font-semibold">{s.name}</span> {t.signalLab.missing}.
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {error ? (
            <div className="hud-panel flex flex-col items-center gap-3 p-10 text-center">
              <FilterX className="h-8 w-8 text-destructive" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t.telemetryView.loadError}</p>
            </div>
          ) : rows.length === 0 && !loading ? (
            <div className="hud-panel flex flex-col items-center gap-3 p-10 text-center">
              <Activity className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t.telemetryView.noResults}</p>
            </div>
          ) : (
            <>
              {/* Gráficos */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="hud-panel p-4">
                  <p className="hud-label mb-3">{t.telemetryView.chartPropagation}</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="idx" tick={axisStyle} stroke="var(--border)" />
                        <YAxis tick={axisStyle} stroke="var(--border)" />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: unknown, name: unknown) => [
                            name === "propagation" ? `${value} cm/s` : `${value} W/cm²`,
                            name === "propagation" ? t.field.propagationSpeed : t.field.radiation,
                          ]}
                          labelFormatter={(l) => `#${l}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="propagation"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="hud-panel p-4">
                  <p className="hud-label mb-3">{t.telemetryView.chartScatter}</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name="O2"
                          unit="%"
                          tick={axisStyle}
                          stroke="var(--border)"
                        />
                        <YAxis type="number" dataKey="y" name="cm/s" tick={axisStyle} stroke="var(--border)" />
                        <ZAxis range={[30, 30]} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          cursor={{ strokeDasharray: "3 3" }}
                          formatter={(value: unknown, name: unknown) =>
                            [String(value), name === "x" ? "O₂ %" : "cm/s"] as [string, string]
                          }
                        />
                        {scatterGroups.map(([name, points], i) => (
                          <Scatter
                            key={name}
                            name={name}
                            data={points}
                            fill={SERIES_PALETTE[i % SERIES_PALETTE.length]}
                            fillOpacity={0.75}
                          />
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  {scatterGroups.length > 1 ? (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {scatterGroups.map(([name], i) => (
                        <span key={name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: SERIES_PALETTE[i % SERIES_PALETTE.length] }}
                            aria-hidden="true"
                          />
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="hud-panel p-4">
                <p className="hud-label mb-3">{t.telemetryView.chartByExperiment}</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats?.byExperiment ?? []}
                      margin={{ top: 4, right: 8, bottom: 0, left: -18 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="shortName" tick={axisStyle} stroke="var(--border)" interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={axisStyle} stroke="var(--border)" allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]} name={t.telemetryView.statsRecords}>
                        {(stats?.byExperiment ?? []).map((e) => (
                          <Cell
                            key={e.shortName}
                            fill={CHART_COLORS[e.combustionType as CombustionType] ?? "var(--primary)"}
                            fillOpacity={0.85}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabla de registros */}
              <div className="hud-panel overflow-hidden">
                <div className="table-head-scan flex items-center justify-between border-b border-border/60 px-4 py-3">
                  <span className="hud-label">{t.telemetryView.tableTitle}</span>
                  <span className="data-mono text-xs text-muted-foreground">
                    {t.telemetryView.records(stats?.total ?? 0)}
                  </span>
                </div>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="data-mono w-8 text-[10px] uppercase" aria-label={t.recordDetail.open} />
                        <TableHead className="data-mono text-[10px] uppercase">#</TableHead>
                        <TableHead className="data-mono text-[10px] uppercase">{t.field.date}</TableHead>
                        <TableHead className="data-mono text-[10px] uppercase">{t.field.investigation}</TableHead>
                        <TableHead className="data-mono text-[10px] uppercase">{t.field.fuel}</TableHead>
                        <TableHead className="data-mono text-[10px] uppercase">O₂ i</TableHead>
                        <TableHead className="data-mono text-[10px] uppercase">O₂ f</TableHead>
                        <TableHead className="data-mono text-[10px] uppercase">CO₂</TableHead>
                        <TableHead className="data-mono text-[10px] uppercase">CO</TableHead>
                        <TableHead className="data-mono text-[10px] uppercase">P (atm)</TableHead>
                        <TableHead className="data-mono text-[10px] uppercase">T (°C)</TableHead>
                        <TableHead className="data-mono text-[10px] uppercase">{t.field.propagationSpeed}</TableHead>
                        <TableHead className="data-mono text-[10px] uppercase">{t.field.results}</TableHead>
                        <TableHead className="data-mono text-[10px] uppercase">Src</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.map((r, i) => (
                        <TableRow
                          key={r.id}
                          className="data-mono cursor-pointer text-xs transition-colors hover:bg-primary/5"
                          onClick={() => openDetail(r)}
                          title={t.recordDetail.open}
                        >
                          <TableCell className="w-8">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              aria-label={t.recordDetail.open}
                              title={t.recordDetail.open}
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetail(r);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell>{dateStr(r.date)}</TableCell>
                          <TableCell className="font-semibold text-primary">
                            {r.investigation?.shortName ?? "—"}
                          </TableCell>
                          <TableCell>{r.fuel || "—"}</TableCell>
                          <TableCell>{pct(r.o2Initial)}</TableCell>
                          <TableCell>{pct(r.o2Final)}</TableCell>
                          <TableCell>{num(r.co2)}</TableCell>
                          <TableCell>{num(r.co, 1)}</TableCell>
                          <TableCell>{num(r.pressure)}</TableCell>
                          <TableCell>{num(r.temperature, 1)}</TableCell>
                          <TableCell className="font-semibold">{num(r.propagationSpeed, 3)}</TableCell>
                          <TableCell className="max-w-40 truncate font-sans" title={r.result}>
                            {r.result || "—"}
                          </TableCell>
                          <TableCell>
                            <SourceBadge source={r.source} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {rows.length > 60 && !showAll ? (
                  <div className="border-t border-border/60 p-2 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
                      {t.telemetryView.showMore(Math.min(rows.length - 60, 240))}
                    </Button>
                  </div>
                ) : null}
              </div>

              <p className="text-xs text-muted-foreground/80">{t.telemetryView.demoNote}</p>
            </>
          )}

          {/* Historial de consultas */}
          <div className="hud-panel p-4">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="hud-label">{t.telemetryView.historyTitle}</span>
            </div>
            {!user ? (
              <p className="text-xs text-muted-foreground">{t.telemetryView.historyEmpty}</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.common.noData}</p>
            ) : (
              <div className="space-y-1.5">
                {history.slice(0, 5).map((h) => (
                  <button
                    key={h.id}
                    onClick={() => applyHistoryItem(h)}
                    className="data-mono flex w-full flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-left text-[11px] transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="text-muted-foreground">{dateStr(h.createdAt)} {h.createdAt.slice(11, 16)}</span>
                    <span className="truncate">
                      {Object.entries(h.filters)
                        .filter(([, v]) => v !== undefined && v !== "")
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(" · ") || "—"}
                    </span>
                    <span className="ml-auto shrink-0 font-semibold text-primary">
                      {t.telemetryView.historyResults(h.results)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <MeasurementDetailDialog
        measurement={detailMeasurement}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        seriesMap={seriesMap}
        seriesOrder={seriesOrder}
      />
    </div>
  );
}
