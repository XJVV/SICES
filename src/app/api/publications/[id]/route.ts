import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const publicationUpdateSchema = z.object({
  citation: z.string().trim().min(1),
  url: z.string().trim().default(""),
  year: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
  investigationId: z.coerce.number().int().positive(),
});

type Params = { params: Promise<{ id: string }> };

// PUT /api/publications/[id] — actualizar
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const body = await req.json();
    const parsed = publicationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const existing = await db.publication.findUnique({ where: { id: numericId } });
    if (!existing) {
      return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
    }
    const investigation = await db.investigation.findUnique({
      where: { id: data.investigationId },
    });
    if (!investigation) {
      return NextResponse.json({ error: "Investigación no encontrada" }, { status: 404 });
    }
    const updated = await db.publication.update({
      where: { id: numericId },
      data: { ...data, year: data.year ?? null },
      include: { investigation: { select: { id: true, psiCode: true, shortName: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/publications/[id]", error);
    return NextResponse.json({ error: "Error al actualizar publicación" }, { status: 500 });
  }
}

// DELETE /api/publications/[id] — eliminar
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const existing = await db.publication.findUnique({ where: { id: numericId } });
    if (!existing) {
      return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
    }
    await db.publication.delete({ where: { id: numericId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/publications/[id]", error);
    return NextResponse.json({ error: "Error al eliminar publicación" }, { status: 500 });
  }
}
