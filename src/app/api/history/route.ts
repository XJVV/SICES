import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/**
 * GET /api/history
 * Últimas consultas con filtros del usuario autenticado.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ history: [] });
  }
  const rows = await db.queryLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({
    history: rows.map((r) => ({
      id: r.id,
      filters: safeParse(r.filters),
      results: r.results,
      createdAt: r.createdAt,
    })),
  });
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
