import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const investigationUpdateSchema = z.object({
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

type Params = { params: Promise<{ id: string }> };

// GET /api/investigations/[id] — detalle con publicaciones, combustibles, variables y mediciones
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const item = await db.investigation.findUnique({
      where: { id: Number(id) },
      include: {
        publications: { orderBy: { year: "asc" } },
        fuels: { select: { id: true, name: true, type: true, description: true } },
        variables: { orderBy: { name: "asc" } },
        measurements: {
          orderBy: [{ date: "asc" }, { id: "asc" }],
          select: {
            id: true,
            fuel: true,
            date: true,
            o2Initial: true,
            o2Final: true,
            co2: true,
            co: true,
            pressure: true,
            temperature: true,
            flow: true,
            radiation: true,
            propagationSpeed: true,
            frames: true,
            result: true,
            source: true,
          },
        },
        _count: { select: { publications: true, measurements: true, variables: true } },
      },
    });
    if (!item) {
      return NextResponse.json({ error: "Investigación no encontrada" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    console.error("GET /api/investigations/[id]", error);
    return NextResponse.json({ error: "Error al obtener investigación" }, { status: 500 });
  }
}

// Observatorio curado: operaciones de edición deshabilitadas.
export async function PUT() { return NextResponse.json({ error: "Escritura web deshabilitada." }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: "Escritura web deshabilitada." }, { status: 405 }); }
