import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const investigationSchema = z.object({
  psiCode: z.string().trim().min(1),
  shortName: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.enum(["PRINCIPAL", "COMPLEMENTARIA"]),
  combustionType: z.enum(["SOLID_SURFACE", "AEROSOL", "LIQUID_DROPLET", "GASEOUS"]),
  platform: z.string().trim().default(""),
  period: z.string().trim().default(""),
  investigator: z.string().trim().default(""),
  doi: z.string().trim().default(""),
  psiUrl: z.string().trim().default(""),
  description: z.string().default(""),
  objectives: z.string().default(""),
  methodology: z.string().default(""),
  fuel: z.string().trim().default(""),
  oxygen: z.string().trim().default(""),
  pressure: z.string().trim().default(""),
  temperature: z.string().trim().default(""),
  flow: z.string().trim().default(""),
  results: z.string().default(""),
  conclusions: z.string().default(""),
  dataAvailable: z.string().default(""),
  filesCount: z.coerce.number().int().nonnegative().nullable().optional(),
});

// GET /api/investigations — lista completa con conteos y combustibles
export async function GET() {
  try {
    const items = await db.investigation.findMany({
      orderBy: [{ category: "asc" }, { psiCode: "asc" }],
      include: {
        _count: { select: { publications: true, measurements: true, variables: true } },
        fuels: { select: { id: true, name: true, type: true } },
      },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/investigations", error);
    return NextResponse.json({ error: "Error al obtener investigaciones" }, { status: 500 });
  }
}

// POST /api/investigations — crear investigación
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = investigationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const existing = await db.investigation.findUnique({ where: { psiCode: data.psiCode } });
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe una investigación con el código ${data.psiCode}` },
        { status: 409 }
      );
    }
    const created = await db.investigation.create({
      data: { ...data, filesCount: data.filesCount ?? null },
      include: {
        _count: { select: { publications: true, measurements: true, variables: true } },
        fuels: { select: { id: true, name: true, type: true } },
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/investigations", error);
    return NextResponse.json({ error: "Error al crear investigación" }, { status: 500 });
  }
}
