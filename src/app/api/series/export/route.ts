import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Original NASA PSI points, not the sampled points shown by Recharts.
function quote(value: number | string | null | undefined): string {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("seriesId");
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!id || !Number.isSafeInteger(id)) return NextResponse.json({ error: "Identificador de serie inválido." }, { status: 400 });
  try {
    const s = await db.dataSeries.findUnique({
      where: { id },
      include: { dataset: { include: { sourceAsset: { select: { sourcePath: true, agency: true } }, investigation: { select: { psiCode: true } } } } },
    });
    if (!s || s.source !== "EXPERIMENT" || s.dataset.sourceAsset?.agency !== "NASA_PSI")
      return NextResponse.json({ error: "Serie sin fuente experimental NASA PSI verificable." }, { status: 404 });
    const points: unknown = JSON.parse(s.pointsJson);
    if (!Array.isArray(points) || points.length > 500000 || points.some(p => !Array.isArray(p) || p.length < 2 || p.length > 4 || !p.every(v => typeof v === "number" && Number.isFinite(v))))
      return NextResponse.json({ error: "Puntos originales no válidos." }, { status: 422 });
    const lines = [
      ["# NASA PSI", s.dataset.investigation.psiCode, "Serie " + s.id].map(quote).join(","),
      ["# Archivo", s.dataset.sourceAsset.sourcePath].map(quote).join(","),
      ["x_original (" + s.xUnit + ")","y_original (" + s.yUnit + ")","error_upper","error_lower"].map(quote).join(","),
      ...points.map(p => [p[0],p[1],p[2]??"",p[3]??""].map(quote).join(","))
    ];
    return new NextResponse("\ufeff" + lines.join("\r\n") + "\r\n", {
      headers: { "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="SICES-'+s.dataset.investigation.psiCode+'-serie-'+id+'.csv"',
        "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json({ error: "No se pudo exportar la serie." }, { status: 500 });
  }
}
