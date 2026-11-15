"use client";

import * as React from "react";
import { Flame, Globe, Moon, RefreshCcw, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider, useLanguage, type Lang } from "@/lib/i18n";
import { AuthProvider, AuthHeaderButton } from "@/components/system/auth";
import { Starfield } from "@/components/system/starfield";
import type { Investigation, Publication } from "@/lib/types";
import { DashboardView } from "@/components/system/dashboard-view";
import { InvestigationsView } from "@/components/system/investigations-view";
import { InvestigationDetailDialog } from "@/components/system/investigation-detail";
import { InvestigationFormDialog } from "@/components/system/investigation-form";
import { TelemetryView } from "@/components/system/telemetry-view";
import { AnalysisView } from "@/components/system/analysis-view";
import { ComparatorView } from "@/components/system/comparator-view";
import { ClassificationView } from "@/components/system/classification-view";
import { PublicationsView } from "@/components/system/publications-view";
import { ObservatoryView } from "@/components/system/observatory-view";
import { VisualizationModeProvider, VisualizationModeToggle } from "@/components/system/visualization-mode";
import { PublicationFormDialog } from "@/components/system/publication-form";

type ViewKey =
  | "dashboard"
  | "investigations"
  | "telemetry"
  | "analysis"
  | "comparator"
  | "classification"
  | "publications"
  | "observatory";

function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  const options: { value: Lang; label: string }[] = [
    { value: "es", label: "ES" },
    { value: "en", label: "EN" },
  ];
  return (
    <div
      className="flex items-center rounded-md border border-border/60"
      role="group"
      aria-label="Language / Idioma"
    >
      <Globe className="mx-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLang(opt.value)}
          aria-pressed={lang === opt.value}
          className={`data-mono rounded px-2 py-1 text-xs font-bold transition-colors ${
            lang === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <Button variant="outline" size="icon" className="h-9 w-9" aria-label="theme" />;
  }
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-9 w-9"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}

function AppInner() {
  const { t } = useLanguage();
  const [view, setView] = React.useState<ViewKey>("observatory");
  const [investigations, setInvestigations] = React.useState<Investigation[]>([]);
  const [publications, setPublications] = React.useState<Publication[]>([]);
  const [measurementsTotal, setMeasurementsTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);

  const [detailTarget, setDetailTarget] = React.useState<Investigation | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [formTarget, setFormTarget] = React.useState<Investigation | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [pubTarget, setPubTarget] = React.useState<Publication | null>(null);
  const [pubOpen, setPubOpen] = React.useState(false);

  const load = React.useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    setLoadError(false);
    try {
      const [invRes, pubRes, measRes] = await Promise.all([
        fetch("/api/investigations"),
        fetch("/api/publications"),
        fetch("/api/measurements?limit=1"),
      ]);
      if (!invRes.ok || !pubRes.ok) throw new Error("fetch failed");
      const invData: Investigation[] = await invRes.json();
      const pubData: Publication[] = await pubRes.json();
      const measData = await measRes.json().catch(() => null);
      setInvestigations(invData);
      setPublications(pubData);
      setMeasurementsTotal(measData?.stats?.total ?? 0);
    } catch {
      setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // refresco global silencioso (p. ej. tras importar datos): no desmonta
  // las vistas ni cierra diálogos
  React.useEffect(() => {
    const handler = () => load({ silent: true });
    window.addEventListener("sices:refresh", handler);
    return () => window.removeEventListener("sices:refresh", handler);
  }, [load]);

  const openDetail = (inv: Investigation) => {
    setDetailTarget(inv);
    setDetailOpen(true);
  };

  const openCreate = () => {
    setFormTarget(null);
    setFormOpen(true);
  };

  const openEdit = (inv: Investigation) => {
    setFormTarget(inv);
    setFormOpen(true);
  };

  const openPubCreate = () => {
    setPubTarget(null);
    setPubOpen(true);
  };

  const openPubEdit = (pub: Publication) => {
    setPubTarget(pub);
    setPubOpen(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="live-dot" aria-hidden="true" />
          <Flame className="h-8 w-8 animate-flicker text-primary" aria-hidden="true" />
        </div>
        <p className="data-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {t.common.loading}
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">{t.common.errorLoad}</p>
        <Button onClick={() => load()} variant="outline">
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          {t.common.retry}
        </Button>
      </div>
    );
  }

  const modules: { key: ViewKey; label: string }[] = [
    { key: "dashboard", label: t.nav.dashboard },
    { key: "observatory", label: "Observatorio" },
    { key: "investigations", label: t.nav.investigations },
    { key: "telemetry", label: t.nav.telemetry },
    { key: "analysis", label: t.nav.analysis },
    { key: "comparator", label: t.nav.comparator },
    { key: "classification", label: t.nav.classification },
    { key: "publications", label: t.nav.publications },
  ];

  return (
    <div className="space-y-6">
      <Tabs value={view} onValueChange={(v) => setView(v as ViewKey)}>
        <div className="overflow-x-auto">
          <TabsList className="h-auto w-full min-w-max justify-start gap-1 bg-muted/40 p-1 backdrop-blur sm:w-fit">
            {modules.map((m, i) => (
              <TabsTrigger
                key={m.key}
                value={m.key}
                className="module-tab gap-2 px-4 py-2 text-sm"
              >
                <span className="data-mono text-[10px] font-bold text-muted-foreground/70" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-4">
          {view === "dashboard" ? (
            <DashboardView
              investigations={investigations}
              publications={publications}
              measurementsTotal={measurementsTotal}
            />
          ) : null}
          {view === "investigations" ? (
            <InvestigationsView
              investigations={investigations}
              onView={openDetail}
              onEdit={openEdit}
              onCreate={openCreate}
              onRefresh={load}
            />
          ) : null}
          {view === "telemetry" ? <TelemetryView /> : null}
          {view === "observatory" ? <ObservatoryView /> : null}
          {view === "analysis" ? <AnalysisView investigations={investigations} /> : null}
          {view === "comparator" ? <ComparatorView investigations={investigations} /> : null}
          {view === "classification" ? (
            <ClassificationView investigations={investigations} onView={openDetail} />
          ) : null}
          {view === "publications" ? (
            <PublicationsView
              publications={publications}
              investigations={investigations}
              onCreate={openPubCreate}
              onEdit={openPubEdit}
              onRefresh={load}
            />
          ) : null}
        </div>
      </Tabs>

      <InvestigationDetailDialog
        investigation={detailTarget}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
      />
      <InvestigationFormDialog
        investigation={formTarget}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={load}
      />
      <PublicationFormDialog
        publication={pubTarget}
        investigations={investigations}
        open={pubOpen}
        onOpenChange={setPubOpen}
        onSaved={load}
      />
    </div>
  );
}

function Shell() {
  const { t } = useLanguage();
  return (
    <div className="relative flex min-h-screen flex-col">
      <Starfield />

      <div className="mission-stripe fixed inset-x-0 top-0 z-40" aria-hidden="true" />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="glow-primary relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10"
                aria-hidden="true"
              >
                <Flame className="h-5 w-5 text-primary" />
                <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-background">
                  <span className="live-dot" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="display-title bg-gradient-to-r from-primary to-amber-400 bg-clip-text text-base font-extrabold leading-tight text-transparent sm:text-lg">
                    SICES
                  </span>
                  <span className="hud-label hidden sm:inline">v2.5</span>
                </div>
                <h1 className="max-w-2xl text-xs font-medium leading-tight text-muted-foreground sm:text-sm">
                  {t.app.title} — Observatorio multiagencia
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <VisualizationModeToggle />
              <LanguageToggle />
              <ThemeToggle />
              <AuthHeaderButton />
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <AppInner />
      </main>

      <footer className="relative z-10 mt-auto border-t border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl space-y-1 px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>{t.footer.source}</p>
            <p className="data-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
              SICES · μg Combustion Data System
            </p>
          </div>
          <p>{t.footer.note}</p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <VisualizationModeProvider>
          <Shell />
          <Toaster />
        </VisualizationModeProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
