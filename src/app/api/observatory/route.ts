import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams;
  const agency = (qs.get("agency") || "").trim().slice(0,100);
  const hardware = (qs.get("hardware") || "").trim().slice(0,100);
  const gravity = (qs.get("gravity") || "").trim().slice(0,100);
  const id = qs.get("investigationId");
  const investigationId = id && /^\d+$/.test(id) ? Number(id) : undefined;
  const invWhere = {
    agency: agency || "NASA_PSI",
    ...(hardware ? {hardware} : {}),
    ...(gravity ? {gravityRegime:gravity} : {}),
    ...(investigationId ? {id:investigationId} : {}),
  };
  const obsWhere = {
    sourceAsset:{agency:agency||"NASA_PSI"},
    ...(investigationId ? {investigationId} : {}),
    ...(hardware ? { OR:[{hardware},{investigation:{hardware}}] } : {}),
    ...(gravity ? {investigation:{gravityRegime:gravity}} : {}),
  };
  try {
    const [sources,agencies,investigations,observations,total,scenarios,limits] = await Promise.all([
      db.sourceAsset.findMany({where:{agency:"NASA_PSI",status:{not:"DUPLICATE"}},select:{id:true,agency:true,sourcePath:true,status:true,warning:true,totalRows:true,normalizedRows:true},take:200,orderBy:{sourcePath:"asc"}}),
      db.investigation.groupBy({by:["agency"],_count:{_all:true},where:{agency:{not:""}}}),
      db.investigation.findMany({where:invWhere,orderBy:{psiCode:"asc"},select:{
        id:true,psiCode:true,shortName:true,name:true,agency:true,hardware:true,hardwareRack:true,gravityRegime:true,laymanSummary:true,earthApplication:true,safetyDomain:true,
        description:true,objectives:true,results:true,fuel:true,oxygen:true,pressure:true,flow:true,psiUrl:true,platform:true,
        _count:{select:{datasets:true,measurements:true,normalizedObservations:true}}
      }}),
      db.normalizedObservation.findMany({where:obsWhere,select:{id:true,rowNumber:true,sheetName:true,o2Percent:true,pressurePsi:true,airflowCmS:true,temperatureC:true,gravityRegime:true,hardware:true,environment:true,investigationId:true,sourceAsset:{select:{agency:true,sourcePath:true}}},take:150,orderBy:{id:"asc"}}),
      db.normalizedObservation.count({where:obsWhere}),
      db.scenarioPreset.findMany({orderBy:{key:"asc"}}),
      db.normalizedObservation.aggregate({where:{sourceAsset:{agency:"NASA_PSI"}},_min:{o2Percent:true,pressurePsi:true,airflowCmS:true},_max:{o2Percent:true,pressurePsi:true,airflowCmS:true}})
    ]);
    const [hardwareValues,gravityValues]=await Promise.all([
      db.investigation.findMany({where:{agency:"NASA_PSI",hardware:{not:""}},select:{hardware:true},distinct:["hardware"]}),
      db.investigation.findMany({where:{agency:"NASA_PSI",gravityRegime:{not:""}},select:{gravityRegime:true},distinct:["gravityRegime"]})
    ]);
    return NextResponse.json({
      counts:{totalRows:total,sources:sources.length,investigations:investigations.length},
      available:{agencies:agencies.filter(a=>a.agency==="NASA_PSI").map(a=>({name:a.agency,files:sources.length})),hardware:hardwareValues.map(h=>h.hardware),gravity:gravityValues.map(g=>g.gravityRegime)},
      investigations,observations,sources,
      scenarios:scenarios.map(s=>({key:s.key,name:s.name,o2:s.oxygenPercent,pressure:s.pressurePsi,gravity:s.gravityRegime,category:s.category,note:s.note,sourceUrl:s.sourceUrl,airflow:null})),
      limits:{oxygen:{min:limits._min.o2Percent,max:limits._max.o2Percent},pressure:{min:limits._min.pressurePsi,max:limits._max.pressurePsi},airflow:{min:limits._min.airflowCmS,max:limits._max.airflowCmS}},
      warnings:total>observations.length?["Vista preliminar: usa exportación para consultar el resto de mediciones."]:[],
    },{headers:noStore});
  } catch {
    return NextResponse.json({error:"No se pudo consultar el observatorio. Ejecuta Prisma, ingesta y curación."},{status:500,headers:noStore});
  }
}
