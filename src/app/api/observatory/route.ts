import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams;
  const agency = (qs.get("agency") || "").trim().slice(0, 100);
  const hardware = (qs.get("hardware") || "").trim().slice(0, 100);
  const gravity = (qs.get("gravity") || "").trim().slice(0, 100);
  const id = qs.get("investigationId");
  const investigationId = id && /^\d+$/.test(id) ? Number(id) : undefined;
  const where = {
    ...(agency ? { sourceAsset: { agency } } : {}),
    ...(hardware ? { hardware } : {}),
    ...(gravity ? { gravityRegime: gravity } : {}),
    ...(investigationId ? { investigationId } : {}),
  };
  try {
    const [sources, agencies, hardwares, gravities, total, observations, investigations, limits, scenarioRows] = await Promise.all([
      db.sourceAsset.findMany({ where: agency ? { agency } : {}, select: { id: true, agency: true, sourcePath: true, status: true, warning: true, totalRows: true, normalizedRows: true }, orderBy: { sourcePath: "asc" }, take: 200 }),
      db.sourceAsset.groupBy({ by: ["agency"], _count: { _all: true } }),
      db.normalizedObservation.groupBy({ by: ["hardware"], _count: { _all: true } }),
      db.normalizedObservation.groupBy({ by: ["gravityRegime"], _count: { _all: true } }),
      db.normalizedObservation.count({ where }),
      db.normalizedObservation.findMany({ where, take: 100, orderBy: { id: "asc" }, select: {
        id: true, rowNumber: true, sheetName: true, o2Percent: true, pressurePsi: true,
        airflowCmS: true, temperatureC: true, gravityRegime: true, hardware: true,
        environment: true, sourceAsset: { select: { agency: true, sourcePath: true } },
        investigation: { select: { id: true, psiCode: true, shortName: true } }
      }}),
      db.investigation.findMany({ where: agency ? { agency } : {}, select: {
        id: true, psiCode: true, shortName: true, name: true, agency: true, hardware: true,
        gravityRegime: true, laymanSummary: true, earthApplication: true, safetyDomain: true,
        objectives: true, description: true
      }, orderBy: { psiCode: "asc" } }),
      db.normalizedObservation.aggregate({ _min: { o2Percent: true, pressurePsi: true, airflowCmS: true }, _max: { o2Percent: true, pressurePsi: true, airflowCmS: true } }),
      db.normalizedObservation.findMany({ where: { environment: { not: "" }, o2Percent: { not: null }, pressurePsi: { not: null } }, take: 1000, select: { environment: true, o2Percent: true, pressurePsi: true, airflowCmS: true } })
    ]);
    const scenarios = new Map<string, {name: string; o2: number; pressure: number; airflow: number|null}>();
    for (const row of scenarioRows) {
      if (row.o2Percent == null || row.pressurePsi == null || !row.environment || scenarios.has(row.environment)) continue;
      scenarios.set(row.environment, { name: row.environment, o2: row.o2Percent, pressure: row.pressurePsi, airflow: row.airflowCmS });
    }
    return NextResponse.json({
      counts: { totalRows: total, sources: sources.length, investigations: investigations.length },
      available: { agencies: agencies.map(a => ({ name: a.agency, files: a._count._all })), hardware: hardwares.map(h=>h.hardware).filter(Boolean), gravity: gravities.map(g=>g.gravityRegime).filter(Boolean) },
      sources, observations, investigations, scenarios: [...scenarios.values()],
      limits: { oxygen: { min: limits._min.o2Percent, max: limits._max.o2Percent },
        pressure: { min: limits._min.pressurePsi, max: limits._max.pressurePsi },
        airflow: { min: limits._min.airflowCmS, max: limits._max.airflowCmS } },
      warnings: total > observations.length ? ["La tabla muestra una muestra paginada; exporta para obtener todas las filas."] : [],
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Faltan tablas o datos: ejecuta npx prisma db push y npm run ingest:batch." }, { status: 500, headers });
  }
}
