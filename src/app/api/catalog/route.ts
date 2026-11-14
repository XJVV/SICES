import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/catalog
 * Catálogos para los selectores de la interfaz: combustibles y
 * experimentos con mediciones, variables por investigación.
 */
export async function GET() {
  const fuels = await db.fuel.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { investigations: true } } },
  });

  const investigations = await db.investigation.findMany({
    orderBy: [{ category: "asc" }, { psiCode: "asc" }],
    select: {
      id: true,
      psiCode: true,
      shortName: true,
      category: true,
      combustionType: true,
      _count: { select: { measurements: true, publications: true, variables: true } },
    },
  });

  const variables = await db.variable.findMany({
    orderBy: [{ investigationId: "asc" }, { name: "asc" }],
    include: { investigation: { select: { shortName: true, psiCode: true } } },
  });

  const fuelsInMeasurements = await db.measurement.groupBy({
    by: ["fuel"],
    _count: { id: true },
  });

  return NextResponse.json({
    fuels: fuels.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      description: f.description,
      investigationsCount: f._count.investigations,
      measurementsCount: fuelsInMeasurements.find((m) => m.fuel === f.name)?._count.id ?? 0,
    })),
    investigations,
    variables,
  });
}
