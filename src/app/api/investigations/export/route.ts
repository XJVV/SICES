import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

// GET /api/investigations/export — descargar listado en CSV (UTF-8 con BOM)
export async function GET() {
  try {
    const items = await db.investigation.findMany({
      orderBy: [{ category: "asc" }, { psiCode: "asc" }],
      include: { _count: { select: { publications: true } } },
    });

    const headers = [
      "Codigo PSI",
      "Nombre corto",
      "Nombre completo",
      "Categoria",
      "Tipo de combustion",
      "Plataforma",
      "Periodo",
      "Investigador principal",
      "DOI",
      "Enlace PSI",
      "Combustible",
      "Oxigeno",
      "Presion",
      "Temperatura",
      "Flujo",
      "Resultados",
      "Conclusiones",
      "Archivos (v4)",
      "Publicaciones",
    ];

    const rows = items.map((i) =>
      [
        i.psiCode,
        i.shortName,
        i.name,
        i.category,
        i.combustionType,
        i.platform,
        i.period,
        i.investigator,
        i.doi,
        i.psiUrl,
        i.fuel,
        i.oxygen,
        i.pressure,
        i.temperature,
        i.flow,
        i.results,
        i.conclusions,
        i.filesCount,
        i._count.publications,
      ]
        .map(csvEscape)
        .join(",")
    );

    const csv = "\uFEFF" + headers.map(csvEscape).join(",") + "\n" + rows.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="investigaciones-combustion-espacial.csv"',
      },
    });
  } catch (error) {
    console.error("GET /api/investigations/export", error);
    return NextResponse.json({ error: "Error al exportar CSV" }, { status: 500 });
  }
}
