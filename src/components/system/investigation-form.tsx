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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import {
  CATEGORIES,
  COMBUSTION_TYPES,
  type Category,
  type CombustionType,
  type Investigation,
  type InvestigationInput,
} from "@/lib/types";

interface InvestigationFormDialogProps {
  investigation: Investigation | null; // null = crear
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const emptyForm: InvestigationInput = {
  psiCode: "",
  shortName: "",
  name: "",
  category: "PRINCIPAL",
  combustionType: "SOLID_SURFACE",
  platform: "",
  period: "",
  investigator: "",
  doi: "",
  psiUrl: "",
  description: "",
  objectives: "",
  methodology: "",
  fuel: "",
  oxygen: "",
  pressure: "",
  temperature: "",
  flow: "",
  results: "",
  conclusions: "",
  dataAvailable: "",
  filesCount: null,
};

function toForm(inv: Investigation): InvestigationInput {
  return {
    psiCode: inv.psiCode,
    shortName: inv.shortName,
    name: inv.name,
    category: inv.category,
    combustionType: inv.combustionType,
    platform: inv.platform,
    period: inv.period,
    investigator: inv.investigator,
    doi: inv.doi,
    psiUrl: inv.psiUrl,
    description: inv.description,
    objectives: inv.objectives,
    methodology: inv.methodology,
    fuel: inv.fuel,
    oxygen: inv.oxygen,
    pressure: inv.pressure,
    temperature: inv.temperature,
    flow: inv.flow,
    results: inv.results,
    conclusions: inv.conclusions,
    dataAvailable: inv.dataAvailable,
    filesCount: inv.filesCount,
  };
}

export function InvestigationFormDialog({
  investigation,
  open,
  onOpenChange,
  onSaved,
}: InvestigationFormDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [form, setForm] = React.useState<InvestigationInput>(emptyForm);
  const [filesStr, setFilesStr] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setForm(investigation ? toForm(investigation) : emptyForm);
      setFilesStr(investigation?.filesCount != null ? String(investigation.filesCount) : "");
      setErrors({});
    }
  }, [open, investigation]);

  const set = <K extends keyof InvestigationInput>(key: K, value: InvestigationInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key as string]: "" }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.psiCode.trim()) e.psiCode = t.common.required;
    if (!form.shortName.trim()) e.shortName = t.common.required;
    if (!form.name.trim()) e.name = t.common.required;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const files = filesStr.trim() === "" ? null : Number(filesStr);
    const payload = { ...form, filesCount: Number.isFinite(files) ? files : null };
    try {
      const res = await fetch(
        investigation ? `/api/investigations/${investigation.id}` : "/api/investigations",
        {
          method: investigation ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.details) {
          const e: Record<string, string> = {};
          for (const [k, v] of Object.entries(body.details as Record<string, string[]>)) {
            e[k] = Array.isArray(v) ? v[0] : String(v);
          }
          setErrors(e);
        }
        toast({ title: t.toast.error, description: body.error ?? "", variant: "destructive" });
        return;
      }
      toast({ title: investigation ? t.toast.updated : t.toast.created });
      onOpenChange(false);
      onSaved();
    } catch {
      toast({ title: t.toast.error, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const err = (k: string) =>
    errors[k] ? <p className="text-xs text-destructive">{errors[k]}</p> : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hud-panel max-h-[90vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {investigation ? t.form.editTitle : t.form.newTitle}
          </DialogTitle>
          <DialogDescription>
            {investigation ? `${investigation.psiCode} — ${investigation.shortName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-2">
              {/* Identificación */}
              <section aria-labelledby="form-id" className="space-y-3">
                <h3 id="form-id" className="text-sm font-semibold">
                  {t.form.identificationSection}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="psiCode">
                      {t.field.psiCode} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="psiCode"
                      value={form.psiCode}
                      onChange={(e) => set("psiCode", e.target.value)}
                      placeholder="PSI-00"
                    />
                    {err("psiCode")}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="shortName">
                      {t.field.shortName} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="shortName"
                      value={form.shortName}
                      onChange={(e) => set("shortName", e.target.value)}
                      placeholder="BASS"
                    />
                    {err("shortName")}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="name">
                      {t.field.name} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Burning and Suppression of Solids"
                    />
                    {err("name")}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="category">
                      {t.field.category} <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => set("category", v as Category)}
                    >
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {t.categoryLabel[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="combustionType">
                      {t.field.combustionType} <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={form.combustionType}
                      onValueChange={(v) => set("combustionType", v as CombustionType)}
                    >
                      <SelectTrigger id="combustionType">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="platform">{t.field.platform}</Label>
                    <Input
                      id="platform"
                      value={form.platform}
                      onChange={(e) => set("platform", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="period">{t.field.period}</Label>
                    <Input
                      id="period"
                      value={form.period}
                      onChange={(e) => set("period", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="investigator">{t.field.investigator}</Label>
                    <Input
                      id="investigator"
                      value={form.investigator}
                      onChange={(e) => set("investigator", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="filesCount">{t.field.filesCount}</Label>
                    <Input
                      id="filesCount"
                      type="number"
                      min={0}
                      value={filesStr}
                      onChange={(e) => setFilesStr(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="doi">{t.field.doi}</Label>
                    <Input
                      id="doi"
                      value={form.doi}
                      onChange={(e) => set("doi", e.target.value)}
                      placeholder="10.60555/..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="psiUrl">{t.field.psiUrl}</Label>
                    <Input
                      id="psiUrl"
                      value={form.psiUrl}
                      onChange={(e) => set("psiUrl", e.target.value)}
                      placeholder="https://psi.nasa.gov/..."
                    />
                  </div>
                </div>
              </section>

              <Separator />

              {/* Contenido científico */}
              <section aria-labelledby="form-content" className="space-y-3">
                <h3 id="form-content" className="text-sm font-semibold">
                  {t.form.contentSection}
                </h3>
                <div className="grid gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="description">{t.field.description}</Label>
                    <Textarea
                      id="description"
                      rows={3}
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="objectives">{t.field.objectives}</Label>
                    <Textarea
                      id="objectives"
                      rows={3}
                      value={form.objectives}
                      onChange={(e) => set("objectives", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="methodology">{t.field.methodology}</Label>
                    <Textarea
                      id="methodology"
                      rows={3}
                      value={form.methodology}
                      onChange={(e) => set("methodology", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="results">{t.field.results}</Label>
                    <Textarea
                      id="results"
                      rows={3}
                      value={form.results}
                      onChange={(e) => set("results", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="conclusions">{t.field.conclusions}</Label>
                    <Textarea
                      id="conclusions"
                      rows={3}
                      value={form.conclusions}
                      onChange={(e) => set("conclusions", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dataAvailable">{t.field.dataAvailable}</Label>
                    <Textarea
                      id="dataAvailable"
                      rows={2}
                      value={form.dataAvailable}
                      onChange={(e) => set("dataAvailable", e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <Separator />

              {/* Variables */}
              <section aria-labelledby="form-vars" className="space-y-3">
                <h3 id="form-vars" className="text-sm font-semibold">
                  {t.form.variablesSection}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fuel">{t.field.fuel}</Label>
                    <Input
                      id="fuel"
                      value={form.fuel}
                      onChange={(e) => set("fuel", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="oxygen">{t.field.oxygen}</Label>
                    <Input
                      id="oxygen"
                      value={form.oxygen}
                      onChange={(e) => set("oxygen", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pressure">{t.field.pressure}</Label>
                    <Input
                      id="pressure"
                      value={form.pressure}
                      onChange={(e) => set("pressure", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="temperature">{t.field.temperature}</Label>
                    <Input
                      id="temperature"
                      value={form.temperature}
                      onChange={(e) => set("temperature", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="flow">{t.field.flow}</Label>
                    <Input
                      id="flow"
                      value={form.flow}
                      onChange={(e) => set("flow", e.target.value)}
                    />
                  </div>
                </div>
              </section>
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
