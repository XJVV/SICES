"use client";

import * as React from "react";
import { Download, ExternalLink, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import {
  CATEGORIES,
  COMBUSTION_TYPES,
  type Category,
  type CombustionType,
  type Investigation,
} from "@/lib/types";
import { CategoryBadge, CombustionBadge, FuelChip } from "./badges";

interface InvestigationsViewProps {
  investigations: Investigation[];
  onView: (inv: Investigation) => void;
  onEdit: (inv: Investigation) => void;
  onCreate: () => void;
  onRefresh: () => void;
}

export function InvestigationsView({
  investigations,
  onView,
  onEdit,
  onCreate,
  onRefresh,
}: InvestigationsViewProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [combustionFilter, setCombustionFilter] = React.useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");
  const [deleteTarget, setDeleteTarget] = React.useState<Investigation | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return investigations.filter((inv) => {
      if (combustionFilter !== "ALL" && inv.combustionType !== combustionFilter) return false;
      if (categoryFilter !== "ALL" && inv.category !== categoryFilter) return false;
      if (!q) return true;
      return [inv.psiCode, inv.shortName, inv.name, inv.fuel, inv.platform, inv.investigator]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [investigations, query, combustionFilter, categoryFilter]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/investigations/${deleteTarget.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: t.toast.error, description: body.error ?? "", variant: "destructive" });
        return;
      }
      toast({ title: t.toast.deleted });
      onRefresh();
    } catch {
      toast({ title: t.toast.error, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="animate-fade-up space-y-4">
      <div className="hud-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="display-title text-xl font-bold">{t.investigationsView.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t.investigationsView.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onCreate} size="sm" className="glow-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t.common.newInvestigation}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/investigations/export" download>
                <Download className="h-4 w-4" aria-hidden="true" />
                {t.common.exportCsv}
              </a>
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.investigationsView.searchPlaceholder}
              className="pl-8"
              aria-label={t.common.search}
            />
          </div>
          <Select value={combustionFilter} onValueChange={setCombustionFilter}>
            <SelectTrigger className="w-full md:w-56" aria-label={t.investigationsView.filterCombustion}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                {t.investigationsView.filterCombustion}: {t.common.all}
              </SelectItem>
              {COMBUSTION_TYPES.map((ct: CombustionType) => (
                <SelectItem key={ct} value={ct}>
                  {t.combustionLabel[ct]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-52" aria-label={t.investigationsView.filterCategory}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                {t.investigationsView.filterCategory}: {t.common.all}
              </SelectItem>
              {CATEGORIES.map((c: Category) => (
                <SelectItem key={c} value={c}>
                  {t.categoryLabel[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="data-mono mt-3 text-xs text-muted-foreground">
          {t.investigationsView.count(filtered.length)}
        </p>
      </div>

      {/* Tabla */}
      <div className="hud-panel overflow-hidden">
        <div className="table-head-scan border-b border-border/60" aria-hidden="true" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="data-mono whitespace-nowrap text-[10px] uppercase tracking-wider">
                  {t.field.psiCode}
                </TableHead>
                <TableHead className="data-mono text-[10px] uppercase tracking-wider">{t.field.name}</TableHead>
                <TableHead className="data-mono text-[10px] uppercase tracking-wider">{t.field.combustionType}</TableHead>
                <TableHead className="data-mono hidden text-[10px] uppercase tracking-wider lg:table-cell">
                  {t.field.fuels}
                </TableHead>
                <TableHead className="data-mono hidden text-[10px] uppercase tracking-wider xl:table-cell">
                  {t.field.platform}
                </TableHead>
                <TableHead className="data-mono text-center text-[10px] uppercase tracking-wider">
                  {t.field.measurements}
                </TableHead>
                <TableHead className="data-mono text-center text-[10px] uppercase tracking-wider">
                  {t.publicationsView.title}
                </TableHead>
                <TableHead className="data-mono text-right text-[10px] uppercase tracking-wider">
                  {t.common.actions}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    {t.investigationsView.noResults}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inv) => (
                  <TableRow key={inv.id} className="group">
                    <TableCell className="whitespace-nowrap">
                      <a
                        href={inv.psiUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="data-mono text-xs font-semibold text-primary underline-offset-2 hover:underline"
                        title={inv.psiUrl || undefined}
                      >
                        {inv.psiCode}
                      </a>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => onView(inv)}
                        className="text-left text-sm font-semibold underline-offset-2 hover:text-primary hover:underline"
                      >
                        {inv.shortName}
                      </button>
                      <p className="hidden max-w-72 truncate text-xs text-muted-foreground md:block">
                        {inv.name}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <CombustionBadge type={inv.combustionType} />
                        <CategoryBadge category={inv.category} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-52 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(inv.fuels ?? []).slice(0, 3).map((f) => (
                          <FuelChip key={f.id} name={f.name} />
                        ))}
                        {(inv.fuels ?? []).length > 3 ? (
                          <span className="data-mono text-[10px] text-muted-foreground">
                            +{(inv.fuels ?? []).length - 3}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-56 truncate text-xs text-muted-foreground xl:table-cell">
                      {inv.platform || t.common.notAvailable}
                    </TableCell>
                    <TableCell className="data-mono text-center text-sm tabular-nums">
                      {inv._count?.measurements ?? 0}
                    </TableCell>
                    <TableCell className="data-mono text-center text-sm tabular-nums">
                      {inv._count?.publications ?? 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onView(inv)}
                          title={t.common.view}
                          aria-label={`${t.common.view} ${inv.shortName}`}
                          className="h-9 w-9"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        {inv.psiUrl ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title={t.common.psiLink}
                            aria-label={`${t.common.openPsi} ${inv.shortName}`}
                            className="h-9 w-9"
                          >
                            <a href={inv.psiUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(inv)}
                          title={t.common.edit}
                          aria-label={`${t.common.edit} ${inv.shortName}`}
                          className="h-9 w-9"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(inv)}
                          title={t.common.delete}
                          aria-label={`${t.common.delete} ${inv.shortName}`}
                          className="h-9 w-9 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="hud-panel">
          <AlertDialogHeader>
            <AlertDialogTitle className="display-title">{t.common.confirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.common.confirmDeleteInv}
              {deleteTarget ? (
                <span className="data-mono mt-2 block text-xs">
                  {deleteTarget.psiCode} — {deleteTarget.shortName}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t.common.yes}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
