import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFilters, buildWhere, filtersToText } from "@/lib/filters";

/**
 * GET /api/export/measurements
 * CSV de mediciones filtradas (UTF-8 con BOM para Excel).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const { filters, errors } = parseFilters(searchParams);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const rows = await db.measurement.findMany({
    where: buildWhere(filters),
    orderBy: [{ investigation: { shortName: "asc" } }, { date: "asc" }, { id: "asc" }],
    include: { investigation: { select: { psiCode: true, shortName: true } } },
  });

  const headers = [
    "id",
    "experimento",
    "codigo_psi",
    "combustible",
    "fecha",
    "o2_inicial_fraccion",
    "o2_final_fraccion",
    "co2_pct",
    "co_ppm",
    "presion_atm",
    "temperatura_c",
    "flujo_cm_s",
    "radiacion_W_cm2",
    "velocidad_propagacion_cm_s",
    "fotogramas",
    "resultado",
    "fuente",
  ];

  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const fmt = (v: number | null) => (v === null || v === undefined ? "" : String(v));
  const pct = (v: number | null) => (v === null || v === undefined ? "" : (v * 100).toFixed(2));

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        esc(r.investigation.shortName),
        esc(r.investigation.psiCode),
        esc(r.fuel),
        r.date ? r.date.toISOString().slice(0, 10) : "",
        pct(r.o2Initial),
        pct(r.o2Final),
        fmt(r.co2),
        fmt(r.co),
        fmt(r.pressure),
        fmt(r.temperature),
        fmt(r.flow),
        fmt(r.radiation),
        fmt(r.propagationSpeed),
        r.frames ?? "",
        esc(r.result),
        esc(r.source),
      ].join(",")
    );
  }

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  return new NextResponse("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mediciones_${stamp}.csv"`,
      "X-Filters-Applied": encodeURIComponent(filtersToText(filters)),
    },
  });
}
