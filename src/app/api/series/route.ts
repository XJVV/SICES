import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Final SICES: only experimental curves ingested from an auditable NASA PSI file.
// Neither historical hand-entered figures nor MODEL/SIMULATION curves enter this API.
export async function GET() {
  try {
    const datasets = await db.dataset.findMany({
      where: { sourceAsset: { agency: "NASA_PSI" }, series: { some: { source: "EXPERIMENT" } } },
      orderBy: [{ investigationId: "asc" }, { sort: "asc" }],
      include: {
        sourceAsset: { select: { sourcePath: true, sha256: true, agency: true } },
        investigation: { select: { id: true, psiCode: true, shortName: true, name: true, combustionType: true } },
        series: { where: { source: "EXPERIMENT" }, orderBy: { sort: "asc" } },
      },
    });
    return NextResponse.json(datasets.map(d => ({
      id: d.id, key: d.key, investigationId: d.investigationId, investigation: d.investigation,
      nameEs: d.nameEs, nameEn: d.nameEn, tag: d.tag, fuel: d.fuel,
      condition: d.condition, doi: d.doi, reference: d.reference, sort: d.sort,
      provenance: d.sourceAsset,
      series: d.series.map(s => ({
        id: s.id, metric: s.metric, xKind: s.xKind, xUnit: s.xUnit,
        yUnit: s.yUnit, label: s.label, source: "EXPERIMENT",
        sort: s.sort, points: JSON.parse(s.decimatedJson || s.pointsJson) as number[][],
        rawPointCount: s.rawPointCount || undefined, decimated: Boolean(s.decimatedJson),
      })),
    })), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/series", error);
    return NextResponse.json({ error: "No se pudieron consultar las series NASA PSI." }, { status: 500 });
  }
}
