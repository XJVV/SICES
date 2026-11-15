import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
const schema = z.object({
  o2Percent: z.number().finite().min(0).max(100),
  pressurePsi: z.number().finite().min(0).max(1000),
  airflowCmS: z.number().finite().min(0).max(100000),
});
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  const q = parsed.data;
  try {
    const rows = await db.normalizedObservation.findMany({
      where: { OR: [ { o2Percent: { not: null } }, { pressurePsi: { not: null } }, { airflowCmS: { not: null } } ] },
      take: 15000,
      select: { id:true, o2Percent:true, pressurePsi:true, airflowCmS:true, investigationId:true,
        sourceAsset:{select:{agency:true,sourcePath:true}},
        investigation:{select:{psiCode:true,shortName:true}} }
    });
    const matches = rows.map(row => {
      const vals: [number|null,number,number][] = [
        [row.o2Percent,q.o2Percent,100], [row.pressurePsi,q.pressurePsi,14.7],
        [row.airflowCmS,q.airflowCmS,100]
      ];
      const comparable = vals.filter((a): a is [number,number,number] => a[0] !== null);
      if (!comparable.length) return null;
      const distance = Math.sqrt(comparable.reduce((sum,[v,target,scale])=>sum+Math.pow((v-target)/scale,2),0)/comparable.length);
      return { id:row.id, investigationId:row.investigationId, label:row.investigation?.shortName || row.investigation?.psiCode || "Registro sin investigación identificada",
        agency:row.sourceAsset.agency, sourcePath:row.sourceAsset.sourcePath, distance, variables:comparable.length };
    }).filter((v): v is NonNullable<typeof v>=>v!==null).sort((a,b)=>b.variables-a.variables || a.distance-b.distance).slice(0,25);
    return NextResponse.json({
      comparedRows: rows.length, matches,
      disclaimer:"Ranking de similitud de condiciones observadas, NO probabilidad de incendio ni predicción de inflamabilidad. Los resultados pueden incluir fuentes no vinculadas a un experimento y requieren verificación científica."
    },{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"No hay una base preparada para simular."},{status:500});
  }
}
