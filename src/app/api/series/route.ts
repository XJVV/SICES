import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/series
 * Conjuntos de datos analizados de las investigaciones (p. ej. PSI-117):
 * series (x, y) reales extraídas de publicaciones, agrupadas por métrica
 * compatible (mismo eje X y unidad Y) para poder superponerlas.
 */
export async function GET() {
  try {
    const datasets = await db.dataset.findMany({
      orderBy: [{ investigationId: "asc" }, { sort: "asc" }],
      include: {
        investigation: {
          select: { id: true, psiCode: true, shortName: true, name: true, combustionType: true },
        },
        series: { orderBy: { sort: "asc" } },
      },
    });

    return NextResponse.json(
      datasets.map((d) => ({
        id: d.id,
        key: d.key,
        investigationId: d.investigationId,
        investigation: d.investigation,
        nameEs: d.nameEs,
        nameEn: d.nameEn,
        tag: d.tag,
        fuel: d.fuel,
        condition: d.condition,
        doi: d.doi,
        reference: d.reference,
        sort: d.sort,
        series: d.series.map((s) => ({
          id: s.id,
          metric: s.metric,
          xKind: s.xKind,
          xUnit: s.xUnit,
          yUnit: s.yUnit,
          label: s.label,
          source: s.source,
          sort: s.sort,
          points: JSON.parse(s.pointsJson) as number[][],
        })),
      }))
    );
  } catch (error) {
    console.error("GET /api/series", error);
    return NextResponse.json([], { status: 500 });
  }
}
