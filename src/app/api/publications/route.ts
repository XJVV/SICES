import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET() {
  try {
    return NextResponse.json(await db.publication.findMany({
      orderBy: [{ investigationId: "asc" }, { year: "asc" }],
      include: { investigation: { select: { id: true, psiCode: true, shortName: true } } },
    }));
  } catch {
    return NextResponse.json({ error: "No fue posible consultar publicaciones." }, { status: 500 });
  }
}
export async function POST() { return NextResponse.json({ error: "Escritura web deshabilitada." }, { status: 405 }); }
