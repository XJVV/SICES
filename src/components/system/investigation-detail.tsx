"use client";

import * as React from "react";
import { ExternalLink, Pencil } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/lib/i18n";
import type { FuelRef, Investigation, Measurement, Variable } from "@/lib/types";
import { CategoryBadge, CombustionBadge, FuelChip, SourceBadge } from "./badges";

interface InvestigationDetailDialogProps {
  investigation: Investigation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (inv: Investigation) => void;
}

interface DetailData extends Investigation {
  publications: { id: number; citation: string; year: number | null; url: string }[];
  fuels: (FuelRef & { description?: string })[];
  variables: Variable[];
  measurements: Measurement[];
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-1">
      <p className="hud-label">{label}</p>
      <p className="text-sm leading-relaxed">
        {value === null || value === undefined || value === "" ? t.common.notAvailable : value}
      </p>
    </div>
  );
}

export function InvestigationDetailDialog({
  investigation,
  open,
  onOpenChange,
  onEdit,
}: InvestigationDetailDialogProps) {
  const { t, lang } = useLanguage();
  const [data, setData] = React.useState<DetailData | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!investigation) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/investigations/${investigation.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load error"))))
      .then((json: DetailData) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [investigation]);

  if (!investigation) return null;
  const d = data ?? investigation;

  const measurements = data?.measurements ?? [];
  const chartData = measurements
    .map((m, i) => ({ idx: i + 1, propagation: m.propagationSpeed }))
    .filter((p) => p.propagation !== null);
  const hasDemo = measurements.some((m) => m.source === "DEMO");

  const tooltipStyle = {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--hud-border)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "var(--popover-foreground)",
    backdropFilter: "blur(8px)",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hud-panel max-h-[90vh] sm:max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-6">
            <span className="data-mono rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {investigation.psiCode}
            </span>
            <DialogTitle className="display-title text-lg leading-snug">
              {investigation.shortName}
            </DialogTitle>
          </div>
          <DialogDescription>{investigation.name}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-3">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <CombustionBadge type={d.combustionType} />
              <CategoryBadge category={d.category} />
              {d.doi ? (
                <span className="data-mono rounded border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
                  DOI: {d.doi}
                </span>
              ) : null}
            </div>

            {/* Combustibles del catálogo */}
            {data && data.fuels.length > 0 ? (
              <div className="space-y-1.5">
                <p className="hud-label">{t.field.fuels}</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.fuels.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1.5 rounded border border-border/60 bg-muted/30 px-2 py-1"
                      title={f.description}
                    >
                      <FuelChip name={f.name} />
                      <span className="text-[10px] text-muted-foreground">{f.type}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <section aria-labelledby="det-id" className="space-y-3">
              <h3 id="det-id" className="hud-label border-b border-border/60 pb-1">
                {t.detail.identification}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.field.platform} value={d.platform} />
                <Field label={t.field.period} value={d.period} />
                <Field label={t.field.investigator} value={d.investigator} />
                <Field
                  label={t.field.filesCount}
                  value={
                    d.filesCount !== null && d.filesCount !== undefined
                      ? d.filesCount.toLocaleString(lang === "es" ? "es-ES" : "en-US")
                      : t.common.notAvailable
                  }
                />
              </div>
            </section>

            <Field label={t.field.description} value={d.description} />
            <Field label={t.field.objectives} value={d.objectives} />
            <Field label={t.field.methodology} value={d.methodology} />

            <Separator />

            <section aria-labelledby="det-var" className="space-y-3">
              <h3 id="det-var" className="hud-label border-b border-border/60 pb-1">
                {t.detail.variables}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.field.fuel} value={d.fuel} />
                <Field label={t.field.oxygen} value={d.oxygen} />
                <Field label={t.field.pressure} value={d.pressure} />
                <Field label={t.field.temperature} value={d.temperature} />
                <Field label={t.field.flow} value={d.flow} />
              </div>

              {/* Variables medidas (catálogo de telemetría) */}
              {data && data.variables.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="hud-label">
                    {t.field.variables} · {data.variables.length}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.variables.map((v) => (
                      <span
                        key={v.id}
                        className="data-mono rounded border border-border/60 bg-muted/30 px-2 py-1 text-[11px]"
                        title={v.description}
                      >
                        {v.name}
                        {v.unit ? <span className="text-muted-foreground"> ({v.unit})</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <Separator />

            {/* Mini gráfico de mediciones */}
            {chartData.length > 1 ? (
              <section aria-labelledby="det-meas" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="det-meas" className="hud-label border-b border-border/60 pb-1">
                    {t.field.measurements} · {measurements.length}
                  </h3>
                  {hasDemo ? <SourceBadge source="DEMO" /> : null}
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="idx" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                      <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${v} cm/s`, t.field.propagationSpeed]} labelFormatter={(l) => `#${l}`} />
                      <Line type="monotone" dataKey="propagation" stroke="var(--primary)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : null}

            <Field label={t.field.results} value={d.results} />
            <Field label={t.field.conclusions} value={d.conclusions} />
            <Field label={t.field.dataAvailable} value={d.dataAvailable} />

            <Separator />

            <section aria-labelledby="det-pub" className="space-y-2">
              <h3 id="det-pub" className="hud-label border-b border-border/60 pb-1">
                {t.detail.associatedPublications}
              </h3>
              {loading ? (
                <p className="text-sm text-muted-foreground">{t.common.loading}</p>
              ) : data && data.publications.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                  {data.publications.map((p) => (
                    <li key={p.id}>
                      {p.citation}
                      {p.year ? <span className="text-muted-foreground"> ({p.year})</span> : null}
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1.5 inline-flex items-center text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t.detail.noPublications}</p>
              )}
            </section>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {d.psiUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a href={d.psiUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {t.common.openPsi}
                </a>
              </Button>
            ) : null}
          </div>
          <Button
            size="sm"
            className="glow-primary"
            onClick={() => {
              onOpenChange(false);
              onEdit(d);
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {t.common.edit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
