import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFilters, buildWhere, filtersToText } from "@/lib/filters";
import { PdfBuilder } from "@/lib/pdf";

/**
 * GET /api/export/report
 * Informe PDF de mediciones filtradas: portada de resumen + tabla completa.
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

  const byExperiment = new Map<string, number>();
  for (const r of rows) {
    byExperiment.set(r.investigation.shortName, (byExperiment.get(r.investigation.shortName) ?? 0) + 1);
  }

  const pdf = new PdfBuilder();
  const ACCENT: [number, number, number] = [0.02, 0.71, 0.8]; // cian
  const DARK: [number, number, number] = [0.04, 0.09, 0.12];
  const GRAY: [number, number, number] = [0.42, 0.46, 0.5];

  // ---- Cabecera ----
  pdf.rect(0, 505, 842, 90, DARK);
  pdf.rect(0, 501, 842, 4, ACCENT);
  pdf.text({ x: 40, y: 556, size: 22, font: "F2", text: "SICES — Informe de Telemetría", color: [1, 1, 1] });
  pdf.text({
    x: 40,
    y: 536,
    size: 9.5,
    font: "F1",
    text: "Sistema de Investigaciones de Combustión Espacial · Repositorio NASA Physical Sciences Informatics (PSI)",
    color: [0.62, 0.72, 0.78],
  });
  const generated = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  pdf.text({ x: 620, y: 556, size: 9, font: "F3", text: `Generado: ${generated}`, color: [0.62, 0.72, 0.78] });
  pdf.text({ x: 620, y: 542, size: 9, font: "F3", text: `Registros: ${rows.length}`, color: [0.62, 0.72, 0.78] });

  // ---- Filtros aplicados ----
  pdf.text({ x: 40, y: 470, size: 12, font: "F2", text: "Filtros aplicados", color: DARK });
  pdf.paragraph({ x: 40, y: 452, width: 760, size: 9.5, text: filtersToText(filters), color: GRAY });

  // ---- Resumen por experimento ----
  pdf.text({ x: 40, y: 414, size: 12, font: "F2", text: "Resumen por experimento", color: DARK });
  let yy = 396;
  const sorted = [...byExperiment.entries()].sort((a, b) => b[1] - a[1]);
  sorted.slice(0, 9).forEach(([name, count]) => {
    const barMax = 420;
    const w = Math.max(30, Math.round((count / Math.max(...sorted.map((s) => s[1]))) * barMax));
    pdf.text({ x: 40, y: yy, size: 9, font: "F1", text: name, color: DARK });
    pdf.rect(190, yy - 1, w, 9, ACCENT);
    pdf.text({ x: 195 + w, y: yy, size: 9, font: "F2", text: String(count), color: DARK });
    yy -= 15;
  });

  // ---- Nota de fuente de datos ----
  if (rows.some((r) => r.source === "DEMO")) {
    pdf.text({
      x: 40,
      y: Math.max(yy - 8, 250),
      size: 8.5,
      font: "F3",
      text: "Nota: los registros marcados como DEMO provienen de datos de demostración con la estructura de la documentación técnica; sustituibles por datos reales del repositorio PSI.",
      color: GRAY,
    });
  }

  // ---- Tabla de mediciones ----
  pdf.newPage();
  pdf.text({ x: 40, y: 556, size: 13, font: "F2", text: "Mediciones filtradas", color: DARK });
  pdf.moveDown(18);

  const num = (v: number | null, digits = 2) =>
    v === null || v === undefined ? "N/D" : v.toFixed(digits).replace(/\.?0+$/, (m) => (m.includes(".") ? "" : m));
  const pct = (v: number | null) => (v === null || v === undefined ? "N/D" : (v * 100).toFixed(1) + "%");

  pdf.table({
    cols: [
      { header: "#", width: 26, align: "right" },
      { header: "Fecha", width: 58 },
      { header: "Experimento", width: 82 },
      { header: "Combustible", width: 68 },
      { header: "O2 ini", width: 46, align: "right" },
      { header: "O2 fin", width: 46, align: "right" },
      { header: "Presion", width: 52, align: "right" },
      { header: "Temp C", width: 50, align: "right" },
      { header: "Flujo", width: 48, align: "right" },
      { header: "Vel. prop", width: 54, align: "right" },
      { header: "Resultado", width: 272 },
    ],
    rows: rows.map((r, i) => [
      String(i + 1),
      r.date ? r.date.toISOString().slice(0, 10) : "N/D",
      r.investigation.shortName,
      r.fuel || "N/D",
      pct(r.o2Initial),
      pct(r.o2Final),
      num(r.pressure, 2),
      num(r.temperature, 1),
      num(r.flow, 1),
      num(r.propagationSpeed, 3),
      r.result || "N/D",
    ]),
  });

  const buf = pdf.build({
    title: "SICES — Informe de Telemetría NASA PSI",
    author: "SICES",
  });

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="informe_telemetria_${stamp}.pdf"`,
    },
  });
}
