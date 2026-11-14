"use client";

import { useLanguage } from "@/lib/i18n";
import { CHART_COLORS, COMBUSTION_TYPES, type Investigation } from "@/lib/types";
import { CategoryBadge } from "./badges";

interface ClassificationViewProps {
  investigations: Investigation[];
  onView: (inv: Investigation) => void;
}

export function ClassificationView({ investigations, onView }: ClassificationViewProps) {
  const { t } = useLanguage();

  return (
    <div className="animate-fade-up space-y-4">
      <div>
        <h2 className="display-title text-xl font-bold">{t.classification.title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t.classification.description}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {COMBUSTION_TYPES.map((type, groupIdx) => {
          const members = investigations.filter((i) => i.combustionType === type);
          const info = t.groupInfo[type];
          return (
            <section key={type} className="hud-panel overflow-hidden">
              <div className="h-1 w-full" style={{ backgroundColor: CHART_COLORS[type] }} aria-hidden="true" />
              <div className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-baseline gap-3">
                    <span className="data-mono text-[10px] font-bold text-muted-foreground/60">
                      GRP-{String(groupIdx + 1).padStart(2, "0")}
                    </span>
                    <h3 className="display-title text-base font-bold">{t.combustionFull[type]}</h3>
                  </div>
                  <span
                    className="data-mono rounded-sm px-2.5 py-0.5 text-xs font-bold text-background"
                    style={{ backgroundColor: CHART_COLORS[type] }}
                  >
                    {members.length}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{info.phenomenon}</p>

                <div className="mt-4">
                  <p className="hud-label mb-2">{t.classification.experiments}</p>
                  <ul className="space-y-1.5">
                    {members.length === 0 ? (
                      <li className="text-sm text-muted-foreground">{t.common.noData}</li>
                    ) : (
                      members.map((inv) => (
                        <li
                          key={inv.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-primary/5"
                        >
                          <button
                            onClick={() => onView(inv)}
                            className="text-left text-sm font-medium underline-offset-2 hover:text-primary hover:underline"
                          >
                            <span className="data-mono text-xs text-muted-foreground">{inv.psiCode}</span>{" "}
                            {inv.shortName}
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="data-mono text-[10px] text-muted-foreground">
                              {inv._count?.measurements ?? 0} {t.field.measurements.toLowerCase()}
                            </span>
                            <CategoryBadge category={inv.category} />
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="mt-4 border-t border-border/60 pt-3">
                  <p className="hud-label mb-1">{t.classification.comparability}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{info.comparability}</p>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
