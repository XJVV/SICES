import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET() {
  try {
    return NextResponse.json(await db.investigation.findMany({
      orderBy: [{ category: "asc" }, { psiCode: "asc" }],
      include: {
        _count: { select: { publications: true, measurements: true, variables: true } },
        fuels: { select: { id: true, name: true, type: true } },
      },
    }));
  } catch {
    return NextResponse.json({ error: "No fue posible consultar el catálogo." }, { status: 500 });
  }
}
export async function POST() { return NextResponse.json({ error: "Catálogo curado; escritura web deshabilitada." }, { status: 405, headers: { Allow: "GET" } }); }
