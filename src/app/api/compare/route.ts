import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const atmospherePsi=14.6959487755;
type NumericField="oxygenPercent"|"pressurePsi"|"airflowCmS"|"temperatureC";
function minmax(values:(number|null)[]) {
  const usable=values.filter((v):v is number=>v!==null&&Number.isFinite(v));
  return usable.length ? {min:Math.min(...usable),max:Math.max(...usable),count:usable.length} : null;
}
export async function GET(req:NextRequest) {
  // Legacy ?a=1&b=2 and multi-selection ?ids=1,2,3 are both supported.
  const ids = req.nextUrl.searchParams.has("ids")
    ? (req.nextUrl.searchParams.get("ids") || "").split(",")
    : [req.nextUrl.searchParams.get("a"), req.nextUrl.searchParams.get("b")];
  if (ids.length < 1 || ids.length > 15 || ids.some(x => !x || !/^\d+$/.test(x))) {
    return NextResponse.json({error:"Selecciona entre una y quince investigaciones válidas."},{status:400});
  }
  const numeric = ids.map(Number);
  if (new Set(numeric).size !== numeric.length) {
    return NextResponse.json({error:"No repitas investigaciones en la comparación."},{status:400});
  }
  try{
    const investigations=await db.investigation.findMany({where:{id:{in:numeric},agency:"NASA_PSI"},select:{
      id:true,psiCode:true,shortName:true,name:true,agency:true,hardware:true,hardwareRack:true,gravityRegime:true,laymanSummary:true,safetyDomain:true,
      platform:true,objectives:true,fuel:true,psiUrl:true,
      _count:{select:{normalizedObservations:true,measurements:true}},
      normalizedObservations:{select:{o2Percent:true,pressurePsi:true,airflowCmS:true,temperatureC:true,sourceAsset:{select:{sourcePath:true}}},take:2000},
      measurements:{where:{source:"PSI"},select:{o2Initial:true,pressure:true,flow:true,temperature:true,result:true},take:250},
      datasets:{select:{key:true,sourceAsset:{select:{sourcePath:true}},_count:{select:{series:true}}},take:50}
    }});
    const profiles=numeric.map(id=>{
      const inv=investigations.find(i=>i.id===id);
      if(!inv)return null;
      const sourceRows=inv.normalizedObservations.map(o=>({
        oxygenPercent:o.o2Percent,pressurePsi:o.pressurePsi,airflowCmS:o.airflowCmS,temperatureC:o.temperatureC
      }));
      // Catalog-only values must never be disguised as directly normalized PSI tables.
      const catalogRows=inv.measurements.filter(m=>!/simulaci[oó]n/i.test(m.result)).map(m=>({
        oxygenPercent:m.o2Initial===null?null:m.o2Initial*100,
        pressurePsi:m.pressure===null?null:m.pressure*atmospherePsi,
        airflowCmS:m.flow,temperatureC:m.temperature
      }));
      const pairs=(["oxygenPercent","pressurePsi","airflowCmS","temperatureC"] as NumericField[]).map(key=>{
        const fromTable=minmax(sourceRows.map(r=>r[key]));
        const fromCatalog=minmax(catalogRows.map(r=>r[key]));
        return [key,{ ...(fromTable||fromCatalog||{}), source:fromTable?"NORMALIZED_PSI_TABLE":fromCatalog?"CATALOG":"UNAVAILABLE" }] as const;
      });
      const metrics=Object.fromEntries(pairs);
      return {
        id:inv.id,psiCode:inv.psiCode,shortName:inv.shortName,name:inv.name,agency:inv.agency,
        hardware:inv.hardware,hardwareRack:inv.hardwareRack,gravityRegime:inv.gravityRegime,laymanSummary:inv.laymanSummary,
        safetyDomain:inv.safetyDomain,platform:inv.platform,objectives:inv.objectives,fuel:inv.fuel,psiUrl:inv.psiUrl,
        metrics,observations:inv._count.normalizedObservations,registeredMeasurements:inv._count.measurements, sampled:inv._count.normalizedObservations > inv.normalizedObservations.length || inv._count.measurements > inv.measurements.length,
        series:inv.datasets.reduce((s,d)=>s+d._count.series,0),
        sourcePaths:[...new Set([...inv.normalizedObservations.map(o=>o.sourceAsset.sourcePath),...inv.datasets.map(d=>d.sourceAsset?.sourcePath||"").filter(Boolean)])].slice(0,15)
      };
    });
    if(profiles.some(p=>p===null))return NextResponse.json({error:"Falta una investigación de NASA PSI."},{status:404});
    return NextResponse.json({profiles,warning:"Se priorizan los rangos de tablas NASA PSI normalizadas; cuando faltan se indica CATALOG como procedencia alternativa. Los rangos NO son ensayos emparejados ni curvas temporales. O₂ expresado en porcentaje y presión en psi. sampled señala límites de lectura."},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error("GET /api/compare", error);return NextResponse.json({error:"No se pudieron comparar las fuentes."},{status:500});}
}
