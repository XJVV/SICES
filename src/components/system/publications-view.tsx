"use client";

import * as React from "react";
import { BookMarked, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { Investigation, Publication } from "@/lib/types";

interface PublicationsViewProps {
  publications: Publication[];
  investigations: Investigation[];
  onCreate: () => void;
  onEdit: (pub: Publication) => void;
  onRefresh: () => void;
}

export function PublicationsView({
  publications,
  investigations,
  onCreate,
  onEdit,
  onRefresh,
}: PublicationsViewProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = React.useState<Publication | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/publications/${deleteTarget.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: t.toast.error, description: body.error ?? "", variant: "destructive" });
        return;
      }
      toast({ title: t.toast.pubDeleted });
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
            <h2 className="display-title text-xl font-bold">{t.publicationsView.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.publicationsView.description}</p>
          </div>
          <Button size="sm" onClick={onCreate} disabled={investigations.length === 0} className="glow-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t.common.newPublication}
          </Button>
        </div>
        <p className="data-mono mt-3 text-xs text-muted-foreground">
          {t.publicationsView.count(publications.length)}
        </p>
      </div>

      <div className="hud-panel overflow-hidden">
        <div className="table-head-scan flex items-center gap-2 border-b border-border/60 px-5 py-3">
          <BookMarked className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="hud-label">{t.publicationsView.title}</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="data-mono w-20 text-[10px] uppercase tracking-wider">{t.field.year}</TableHead>
                <TableHead className="data-mono text-[10px] uppercase tracking-wider">{t.field.citation}</TableHead>
                <TableHead className="data-mono w-44 text-[10px] uppercase tracking-wider">{t.field.investigation}</TableHead>
                <TableHead className="data-mono w-24 text-right text-[10px] uppercase tracking-wider">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {publications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    {t.publicationsView.noPublications}
                  </TableCell>
                </TableRow>
              ) : (
                publications.map((pub) => (
                  <TableRow key={pub.id} className="group">
                    <TableCell className="data-mono tabular-nums">{pub.year ?? t.common.notAvailable}</TableCell>
                    <TableCell className="max-w-xl text-sm leading-relaxed">
                      {pub.citation}
                      {pub.url ? (
                        <a
                          href={pub.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span className="data-mono text-xs text-muted-foreground">
                        {pub.investigation?.psiCode ?? ""}
                      </span>{" "}
                      <span className="text-sm">{pub.investigation?.shortName ?? ""}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(pub)}
                          title={t.common.edit}
                          aria-label={`${t.common.edit} ${pub.id}`}
                          className="h-9 w-9"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(pub)}
                          title={t.common.delete}
                          aria-label={`${t.common.delete} ${pub.id}`}
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
            <AlertDialogDescription>{t.common.confirmDeletePub}</AlertDialogDescription>
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
