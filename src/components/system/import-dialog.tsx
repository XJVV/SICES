"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Trash2,
  Undo2,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";
import { extractPsiCode, importHints } from "@/lib/import-parser";
import type { CombustionType } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Tipos del reporte (espejo de /api/import)                           */
/* ------------------------------------------------------------------ */

interface SeriesReport {
  metric: string;
  label: string;
  source: string;
  points: number;
}

interface DatasetReport {
  key: string;
  name: string;
  tag: string;
  seriesCount: number;
  pointsTotal: number;
  skipped: boolean;
  created: boolean;
  series: SeriesReport[];
}

interface FileReport {
  fileName: string;
  psiCode: string | null;
  ok: boolean;
  error?: string;
  investigationId?: number;
  investigationCreated: boolean;
  dataset?: DatasetReport;
  warnings: string[];
}

interface ImportResponse {
  results: FileReport[];
  dry: boolean;
  createdDatasetKeys: string[];
  summary: {
    files: number;
    ok: number;
    datasetsCreated: number;
    datasetsSkipped: number;
    investigationsCreated: number;
    seriesCreated: number;
    pointsCreated: number;
  };
}

interface InvMeta {
  shortName: string;
  name: string;
  category: "PRINCIPAL" | "COMPLEMENTARIA";
  combustionType: CombustionType;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
  existingCodes: string[];
}

const COMBUSTION_TYPES: CombustionType[] = [
  "SOLID_SURFACE",
  "AEROSOL",
  "LIQUID_DROPLET",
  "GASEOUS",
];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
  existingCodes,
}: ImportDialogProps) {
  const { t } = useLanguage();
  const L = t.importData;

  const [files, setFiles] = React.useState<File[]>([]);
  const [psiFallback, setPsiFallback] = React.useState("");
  const [metas, setMetas] = React.useState<Record<string, InvMeta>>({});
  const [busy, setBusy] = React.useState<"analyze" | "import" | "undo" | null>(null);
  const [preview, setPreview] = React.useState<ImportResponse | null>(null);
  const [report, setReport] = React.useState<ImportResponse | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [netError, setNetError] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      // al cerrar, mantener el reporte hasta la próxima apertura
    }
  }, [open]);

  const reset = () => {
    setFiles([]);
    setPsiFallback("");
    setMetas({});
    setPreview(null);
    setReport(null);
    setExpanded(null);
    setNetError(false);
    setBusy(null);
  };

  const addFiles = (incoming: FileList | File[]) => {
    const ok = Array.from(incoming).filter((f) => /\.(csv|tsv|txt)$/i.test(f.name));
    setFiles((prev) => {
      const names = new Set(prev.map((p) => p.name));
      return [...prev, ...ok.filter((f) => !names.has(f.name))];
    });
    setReport(null);
    setPreview(null);
  };

  // códigos detectados en los archivos
  const detectedCodes = React.useMemo(() => {
    const codes = new Map<string, number>(); // code → nº archivos
    for (const f of files) {
      const c = extractPsiCode(f.name) ?? (psiFallback.trim() ? `PSI-${psiFallback.trim().replace(/^psi[-_ ]*/i, "")}` : null);
      if (c) codes.set(c, (codes.get(c) ?? 0) + 1);
    }
    return codes;
  }, [files, psiFallback]);

  const missingCode = files.some(
    (f) => !extractPsiCode(f.name) && !psiFallback.trim()
  );

  // metadatos para investigaciones nuevas
  React.useEffect(() => {
    const next: Record<string, InvMeta> = { ...metas };
    let changed = false;
    // primer archivo de cada código: sus sugerencias (CFI-G → gaseosa…)
    const fileByCode = new Map<string, File>();
    for (const f of files) {
      const c =
        extractPsiCode(f.name) ??
        (psiFallback.trim() ? `PSI-${psiFallback.trim().replace(/^psi[-_ ]*/i, "")}` : null);
      if (c && !fileByCode.has(c)) fileByCode.set(c, f);
    }
    for (const [code, file] of fileByCode) {
      if (!existingCodes.includes(code) && !next[code]) {
        const h = importHints(file.name);
        next[code] = {
          shortName: h.shortName ?? code,
          name: h.name ?? `${code} — datos importados`,
          category: "COMPLEMENTARIA",
          combustionType: (h.combustionType ?? "LIQUID_DROPLET") as CombustionType,
        };
        changed = true;
      }
    }
    for (const code of Object.keys(next)) {
      if (!fileByCode.has(code) || existingCodes.includes(code)) {
        delete next[code];
        changed = true;
      }
    }
    if (changed) setMetas(next);
  }, [detectedCodes, existingCodes, files, psiFallback]);

  const newCodes = [...detectedCodes.keys()].filter((c) => !existingCodes.includes(c));

  const buildForm = (dry: boolean): FormData => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    if (psiFallback.trim()) {
      const norm = psiFallback.trim().replace(/^psi[-_ ]*/i, "");
      form.append("psi", `PSI-${norm}`);
    }
    const metaPayload: Record<string, InvMeta> = {};
    for (const [code, m] of Object.entries(metas)) {
      if (newCodes.includes(code)) metaPayload[code] = m;
    }
    if (Object.keys(metaPayload).length > 0) {
      form.append("meta", JSON.stringify(metaPayload));
    }
    if (dry) form.append("dry", "1");
    return form;
  };

  const run = async (dry: boolean) => {
    setBusy(dry ? "analyze" : "import");
    setNetError(false);
    try {
      const res = await fetch("/api/import", { method: "POST", body: buildForm(dry) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ImportResponse;
      if (dry) setPreview(data);
      else {
        setReport(data);
        if (data.summary.datasetsCreated > 0) {
          onImported();
          window.dispatchEvent(new Event("sices:refresh"));
        }
      }
    } catch {
      setNetError(true);
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    if (!report) return;
    setBusy("undo");
    setNetError(false);
    try {
      // solo las investigaciones creadas por esta importación (y no
      // omitidas) pueden eliminarse al deshacer
      const invIds = report.results
        .filter((r) => r.investigationCreated && r.ok && !r.dataset?.skipped)
        .map((r) => r.investigationId)
        .filter((id): id is number => typeof id === "number");
      const res = await fetch("/api/import", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetKeys: report.createdDatasetKeys,
          investigationIds: invIds,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onImported();
      window.dispatchEvent(new Event("sices:refresh"));
      reset();
    } catch {
      setNetError(true);
    } finally {
      setBusy(null);
    }
  };

  const sourceBadge = (s: string) => {
    const styles: Record<string, string> = {
      EXPERIMENT: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
      SIMULATION: "border-violet-500/40 bg-violet-500/10 text-violet-500",
      MODEL: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    };
    return styles[s] ?? "border-border/60 bg-muted/40 text-muted-foreground";
  };

  const FileResults = ({ data }: { data: ImportResponse }) => (
    <div className="space-y-2">
      {data.results.map((r) => {
        const isOpen = expanded === r.fileName;
        return (
          <div
            key={r.fileName}
            className={`rounded-md border ${
              r.ok ? "border-border/60" : "border-destructive/50"
            } bg-muted/10`}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
              onClick={() => setExpanded(isOpen ? null : r.fileName)}
            >
              {r.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{r.fileName}</span>
              {r.psiCode ? (
                <span className="data-mono shrink-0 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  {r.psiCode}
                </span>
              ) : null}
              {r.dataset ? (
                <span className="data-mono shrink-0 text-[10px] text-muted-foreground">
                  {r.dataset.skipped
                    ? L.skipped
                    : `${r.dataset.seriesCount} ${L.seriesWord} · ${r.dataset.pointsTotal.toLocaleString()} ${L.pointsWord}`}
                </span>
              ) : null}
              {r.investigationCreated ? (
                <span className="shrink-0 rounded border border-border/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                  {L.newInvTag}
                </span>
              ) : null}
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {isOpen ? (
              <div className="space-y-2 border-t border-border/50 px-3 py-2.5">
                {r.error ? (
                  <p className="text-xs text-destructive">{r.error}</p>
                ) : null}
                {r.dataset && r.dataset.series.length > 0 ? (
                  <div className="space-y-1">
                    <p className="hud-label">
                      {r.dataset.name} · {r.dataset.tag}
                    </p>
                    <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                      {r.dataset.series.map((s, i) => (
                        <div
                          key={`${s.label}-${i}`}
                          className="flex items-center gap-2 rounded bg-background/60 px-2 py-1 text-[11px]"
                        >
                          <span
                            className={`data-mono shrink-0 rounded border px-1 py-0.5 text-[9px] font-bold ${sourceBadge(s.source)}`}
                          >
                            {s.source.slice(0, 3)}
                          </span>
                          <span className="data-mono min-w-0 flex-1 truncate">{s.metric}</span>
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            {s.label}
                          </span>
                          <span className="data-mono shrink-0 text-muted-foreground">
                            {s.points} {L.pointsWord}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {r.dataset?.skipped ? (
                  <p className="text-[11px] text-muted-foreground">{L.skippedHint}</p>
                ) : null}
                {r.warnings.length > 0 ? (
                  <div className="space-y-0.5">
                    <p className="hud-label">{L.warningsWord}</p>
                    {r.warnings.map((w, i) => (
                      <p key={i} className="text-[11px] leading-snug text-muted-foreground">
                        · {w}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  const canImport =
    files.length > 0 && !missingCode && busy === null && !netError;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v && report) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="display-title flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" aria-hidden="true" />
            {L.title}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {L.subtitle}
          </DialogDescription>
        </DialogHeader>

        {report ? (
          /* ------------------------- Reporte final ------------------------- */
          <div className="space-y-3">
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
              <p className="text-xs font-semibold">
                {L.reportSummary
                  .replace("{datasets}", String(report.summary.datasetsCreated))
                  .replace("{series}", String(report.summary.seriesCreated))
                  .replace("{points}", report.summary.pointsCreated.toLocaleString())
                  .replace("{files}", String(report.summary.files))}
              </p>
              {report.summary.investigationsCreated > 0 ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {L.invsCreated
                    .replace("{n}", String(report.summary.investigationsCreated))}
                </p>
              ) : null}
            </div>
            <FileResults data={report} />
            {netError ? (
              <p className="text-xs text-destructive">{L.errNetwork}</p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {report.createdDatasetKeys.length > 0 ? (
                <Button variant="outline" size="sm" onClick={undo} disabled={busy !== null}>
                  {busy === "undo" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {L.undo}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={reset}>
                {L.addMore}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(reset, 200);
                }}
              >
                {L.viewData}
              </Button>
            </div>
          </div>
        ) : (
          /* --------------------- Selección de archivos --------------------- */
          <div className="space-y-3">
            <div
              role="button"
              tabIndex={0}
              aria-label={L.dropTitle}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/10"
                  : "border-border/70 hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              <UploadCloud
                className={`h-8 w-8 ${dragOver ? "text-primary" : "text-muted-foreground/60"}`}
                aria-hidden="true"
              />
              <p className="text-sm font-medium">{L.dropTitle}</p>
              <p className="text-[11px] text-muted-foreground">{L.dropHint}</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {files.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="hud-label">
                    {L.filesWord} ({files.length})
                  </p>
                  <button
                    type="button"
                    className="data-mono text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => setFiles([])}
                  >
                    {t.common.clear}
                  </button>
                </div>
                {files.map((f) => {
                  const code = extractPsiCode(f.name);
                  return (
                    <div
                      key={f.name}
                      className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/10 px-2.5 py-1.5"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-xs">{f.name}</span>
                      <span className="data-mono shrink-0 text-[10px] text-muted-foreground">
                        {fmtSize(f.size)}
                      </span>
                      {code ? (
                        <span
                          className={`data-mono shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                            existingCodes.includes(code)
                              ? "border-border/60 bg-muted/40 text-muted-foreground"
                              : "border-primary/40 bg-primary/10 text-primary"
                          }`}
                        >
                          {code}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">
                          {L.noCodeTag}
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label={`${L.remove} ${f.name}`}
                        onClick={() => setFiles((prev) => prev.filter((p) => p.name !== f.name))}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {files.some((f) => !extractPsiCode(f.name)) ? (
              <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2.5">
                <Label htmlFor="psi-fallback" className="text-xs">
                  {L.psiField}
                </Label>
                <Input
                  id="psi-fallback"
                  value={psiFallback}
                  onChange={(e) => setPsiFallback(e.target.value)}
                  placeholder="PSI-159"
                  className="data-mono h-8 text-xs"
                />
              </div>
            ) : null}

            {newCodes.length > 0 ? (
              <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
                <p className="hud-label">{L.newInvestigations}</p>
                <p className="text-[11px] leading-snug text-muted-foreground">{L.newInvHint}</p>
                {newCodes.map((code) => {
                  const m = metas[code];
                  if (!m) return null;
                  return (
                    <div key={code} className="space-y-2 rounded-md border border-border/60 bg-background/70 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="data-mono rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                          {code}
                        </span>
                        <span className="data-mono text-[10px] text-muted-foreground">
                          {detectedCodes.get(code)} {L.filesWord.toLowerCase()}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.field.shortName}</Label>
                          <Input
                            value={m.shortName}
                            onChange={(e) =>
                              setMetas((prev) => ({
                                ...prev,
                                [code]: { ...m, shortName: e.target.value },
                              }))
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.field.name}</Label>
                          <Input
                            value={m.name}
                            onChange={(e) =>
                              setMetas((prev) => ({
                                ...prev,
                                [code]: { ...m, name: e.target.value },
                              }))
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.field.category}</Label>
                          <Select
                            value={m.category}
                            onValueChange={(v) =>
                              setMetas((prev) => ({
                                ...prev,
                                [code]: { ...m, category: v as InvMeta["category"] },
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["PRINCIPAL", "COMPLEMENTARIA"] as const).map((c) => (
                                <SelectItem key={c} value={c}>
                                  {t.categoryLabel[c]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.field.combustionType}</Label>
                          <Select
                            value={m.combustionType}
                            onValueChange={(v) =>
                              setMetas((prev) => ({
                                ...prev,
                                [code]: { ...m, combustionType: v as CombustionType },
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COMBUSTION_TYPES.map((ct) => (
                                <SelectItem key={ct} value={ct}>
                                  {t.combustionFull[ct]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {preview && !report ? (
              <div className="space-y-1.5">
                <p className="hud-label">{L.previewTitle}</p>
                <FileResults data={preview} />
              </div>
            ) : null}

            {netError ? <p className="text-xs text-destructive">{L.errNetwork}</p> : null}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => run(true)}
                disabled={!canImport}
              >
                {busy === "analyze" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileText className="h-4 w-4" aria-hidden="true" />
                )}
                {L.analyze}
              </Button>
              <Button size="sm" onClick={() => run(false)} disabled={!canImport}>
                {busy === "import" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                )}
                {L.importBtn} ({files.length})
              </Button>
            </div>
            <p className="text-[10px] leading-snug text-muted-foreground/70">
              {L.footnote}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Botón de apertura reutilizable */
export function ImportButton({
  onClick,
  label,
  variant = "outline",
  size = "sm",
}: {
  onClick: () => void;
  label: string;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
}) {
  return (
    <Button variant={variant} size={size} onClick={onClick}>
      <UploadCloud className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

/** Icono de eliminar usado en el reporte (evita import sin usar) */
export const ImportTrashIcon = Trash2;
