"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import type { Investigation, Publication } from "@/lib/types";

interface PublicationFormDialogProps {
  publication: Publication | null; // null = crear
  investigations: Investigation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function PublicationFormDialog({
  publication,
  investigations,
  open,
  onOpenChange,
  onSaved,
}: PublicationFormDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [citation, setCitation] = React.useState("");
  const [yearStr, setYearStr] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [investigationId, setInvestigationId] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{ citation?: string; investigationId?: string }>({});

  React.useEffect(() => {
    if (open) {
      setCitation(publication?.citation ?? "");
      setYearStr(publication?.year != null ? String(publication.year) : "");
      setUrl(publication?.url ?? "");
      setInvestigationId(
        publication?.investigationId != null ? String(publication.investigationId) : ""
      );
      setErrors({});
    }
  }, [open, publication]);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: { citation?: string; investigationId?: string } = {};
    if (!citation.trim()) e.citation = t.common.required;
    if (!investigationId) e.investigationId = t.common.required;
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    const year = yearStr.trim() === "" ? null : Number(yearStr);
    try {
      const res = await fetch(
        publication ? `/api/publications/${publication.id}` : "/api/publications",
        {
          method: publication ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            citation: citation.trim(),
            year,
            url: url.trim(),
            investigationId: Number(investigationId),
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: t.toast.error, description: body.error ?? "", variant: "destructive" });
        return;
      }
      toast({ title: publication ? t.toast.pubUpdated : t.toast.pubCreated });
      onOpenChange(false);
      onSaved();
    } catch {
      toast({ title: t.toast.error, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hud-panel sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="display-title">{publication ? t.form.editPubTitle : t.form.newPubTitle}</DialogTitle>
          <DialogDescription>{t.form.pubHint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pub-inv">
              {t.field.investigation} <span className="text-destructive">*</span>
            </Label>
            <Select value={investigationId} onValueChange={(v) => {
              setInvestigationId(v);
              setErrors((e) => ({ ...e, investigationId: undefined }));
            }}>
              <SelectTrigger id="pub-inv">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {investigations.map((inv) => (
                  <SelectItem key={inv.id} value={String(inv.id)}>
                    {inv.psiCode} — {inv.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.investigationId ? (
              <p className="text-xs text-destructive">{errors.investigationId}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pub-citation">
              {t.field.citation} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="pub-citation"
              rows={3}
              value={citation}
              onChange={(e) => {
                setCitation(e.target.value);
                setErrors((er) => ({ ...er, citation: undefined }));
              }}
              placeholder="Autor(es) (año), disponible desde PSI-XX."
            />
            {errors.citation ? (
              <p className="text-xs text-destructive">{errors.citation}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pub-year">
              {t.field.year} <span className="text-xs font-normal text-muted-foreground">({t.common.optional})</span>
            </Label>
            <Input
              id="pub-year"
              type="number"
              min={1900}
              max={2100}
              value={yearStr}
              onChange={(e) => setYearStr(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pub-url">
              {t.field.url} <span className="text-xs font-normal text-muted-foreground">({t.common.optional})</span>
            </Label>
            <Input
              id="pub-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://doi.org/..."
              className="input-terminal"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t.common.loading : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
