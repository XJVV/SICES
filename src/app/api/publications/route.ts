import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const publicationSchema = z.object({
  citation: z.string().trim().min(1),
  url: z.string().trim().default(""),
  year: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
  investigationId: z.coerce.number().int().positive(),
});

// GET /api/publications — lista completa con su investigación
export async function GET() {
  try {
    const items = await db.publication.findMany({
      orderBy: [{ investigationId: "asc" }, { year: "asc" }],
      include: { investigation: { select: { id: true, psiCode: true, shortName: true } } },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/publications", error);
    return NextResponse.json({ error: "Error al obtener publicaciones" }, { status: 500 });
  }
}

// POST /api/publications — crear publicación
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = publicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const investigation = await db.investigation.findUnique({
      where: { id: data.investigationId },
    });
    if (!investigation) {
      return NextResponse.json({ error: "Investigación no encontrada" }, { status: 404 });
    }
    const created = await db.publication.create({
      data: { ...data, year: data.year ?? null },
      include: { investigation: { select: { id: true, psiCode: true, shortName: true } } },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/publications", error);
    return NextResponse.json({ error: "Error al crear publicación" }, { status: 500 });
  }
}
