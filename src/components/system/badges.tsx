"use client";

import { Badge } from "@/components/ui/badge";
import { COMBUSTION_COLORS, type Category, type CombustionType } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

export function CombustionBadge({ type }: { type: CombustionType }) {
  const { t } = useLanguage();
  return (
    <Badge variant="outline" className={`border ${COMBUSTION_COLORS[type]} font-medium`}>
      {t.combustionLabel[type] ?? type}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: Category }) {
  const { t } = useLanguage();
  if (category === "PRINCIPAL") {
    return (
      <Badge
        variant="outline"
        className="border border-cyan-500/40 bg-cyan-500/10 font-medium text-cyan-600 dark:text-cyan-300"
      >
        {t.categoryLabel[category]}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border bg-background font-medium text-muted-foreground">
      {t.categoryLabel[category]}
    </Badge>
  );
}

export function PsiBadge({ code, href }: { code: string; href?: string }) {
  return (
    <a
      href={href || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="data-mono inline-flex items-center rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15"
      title={href}
    >
      {code}
    </a>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const { t } = useLanguage();
  if (source === "DEMO") {
    return (
      <Badge
        variant="outline"
        className="border border-amber-500/40 bg-amber-500/10 text-[10px] font-bold tracking-wider text-amber-500 dark:text-amber-300"
      >
        {t.telemetryView.demoBadge}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border border-emerald-500/40 bg-emerald-500/10 text-[10px] font-bold tracking-wider text-emerald-600 dark:text-emerald-300"
    >
      PSI
    </Badge>
  );
}

export function FuelChip({ name }: { name: string }) {
  return (
    <span className="data-mono inline-flex items-center rounded-sm border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
      {name}
    </span>
  );
}
