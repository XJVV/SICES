import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFilters, buildWhere } from "@/lib/filters";
import { getSessionUser } from "@/lib/auth";

/**
 * GET /api/measurements
 * Lista de mediciones con filtros numéricos + estadísticas agregadas.
 * Registra la consulta en el historial si hay usuario con sesión activa.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const { filters, errors } = parseFilters(searchParams);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const where = buildWhere(filters);
  const limit = Math.min(parseInt(searchParams.get("limit") || "500", 10) || 500, 2000);

  const rows = await db.measurement.findMany({
    where,
    orderBy: [{ investigation: { shortName: "asc" } }, { date: "asc" }, { id: "asc" }],
    take: limit,
    include: { investigation: { select: { id: true, psiCode: true, shortName: true } } },
  });

  // Estadísticas agregadas sobre el conjunto filtrado
  const agg = await db.measurement.aggregate({
    where,
    _count: { id: true },
    _min: { o2Initial: true, pressure: true, temperature: true, propagationSpeed: true, date: true },
    _max: { o2Initial: true, pressure: true, temperature: true, propagationSpeed: true, date: true },
    _avg: { o2Initial: true, o2Final: true, co2: true, co: true, pressure: true, temperature: true, flow: true, radiation: true, propagationSpeed: true },
  });

  const byExperimentRaw = await db.measurement.groupBy({
    by: ["investigationId"],
    where,
    _count: { id: true },
  });
  const invIds = byExperimentRaw.map((g) => g.investigationId);
  const invs = invIds.length
    ? await db.investigation.findMany({
        where: { id: { in: invIds } },
        select: { id: true, psiCode: true, shortName: true, combustionType: true },
      })
    : [];
  const byExperiment = byExperimentRaw
    .map((g) => {
      const inv = invs.find((i) => i.id === g.investigationId);
      return inv ? { shortName: inv.shortName, psiCode: inv.psiCode, combustionType: inv.combustionType, count: g._count.id } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.count - a.count);

  // Historial de consultas (solo usuarios autenticados; nolog=1 para cargas en segundo plano)
  const nolog = searchParams.get("nolog") === "1";
  const user = await getSessionUser();
  if (user && !nolog) {
    try {
      await db.queryLog.create({
        data: {
          userId: user.id,
          endpoint: "/api/measurements",
          filters: JSON.stringify(filters),
          results: agg._count.id,
        },
      });
    } catch {
      // el historial nunca debe romper la consulta
    }
  }

  return NextResponse.json({
    rows,
    stats: {
      total: agg._count.id,
      o2InitialMin: agg._min.o2Initial,
      o2InitialMax: agg._max.o2Initial,
      pressureMin: agg._min.pressure,
      pressureMax: agg._max.pressure,
      temperatureMin: agg._min.temperature,
      temperatureMax: agg._max.temperature,
      propagationMin: agg._min.propagationSpeed,
      propagationMax: agg._max.propagationSpeed,
      dateMin: agg._min.date,
      dateMax: agg._max.date,
      avg: {
        o2Initial: agg._avg.o2Initial,
        o2Final: agg._avg.o2Final,
        co2: agg._avg.co2,
        co: agg._avg.co,
        pressure: agg._avg.pressure,
        temperature: agg._avg.temperature,
        flow: agg._avg.flow,
        radiation: agg._avg.radiation,
        propagationSpeed: agg._avg.propagationSpeed,
      },
      byExperiment,
    },
  });
}
