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

// Observatorio curado: operaciones de edición deshabilitadas.
export async function PUT() { return NextResponse.json({ error: "Escritura web deshabilitada." }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: "Escritura web deshabilitada." }, { status: 405 }); }
