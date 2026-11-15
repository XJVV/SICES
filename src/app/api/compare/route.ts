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
  const ids=[req.nextUrl.searchParams.get("a"),req.nextUrl.searchParams.get("b")];
  if(ids.some(x=>!x||!/^\d+$/.test(x!)))return NextResponse.json({error:"Selecciona dos investigaciones."},{status:400});
  const numeric=ids.map(Number);
  if(numeric[0]===numeric[1])return NextResponse.json({error:"Selecciona dos investigaciones diferentes."},{status:400});
  try{
    const investigations=await db.investigation.findMany({where:{id:{in:numeric},agency:"NASA_PSI"},select:{
      id:true,psiCode:true,shortName:true,name:true,agency:true,hardware:true,hardwareRack:true,gravityRegime:true,laymanSummary:true,safetyDomain:true,
      platform:true,objectives:true,fuel:true,psiUrl:true,
      normalizedObservations:{select:{o2Percent:true,pressurePsi:true,airflowCmS:true,temperatureC:true,sourceAsset:{select:{sourcePath:true}}},take:2000},
      measurements:{where:{source:"PSI"},select:{o2Initial:true,pressure:true,flow:true,temperature:true,result:true},take:250},
      datasets:{select:{key:true,sourceAsset:{select:{sourcePath:true}},_count:{select:{series:true}}},take:50}
    }});
    const profiles=numeric.map(id=>{
      const inv=investigations.find(i=>i.id===id);
      if(!inv)return null;
      const rows=inv.normalizedObservations.map(o=>({
        oxygenPercent:o.o2Percent,pressurePsi:o.pressurePsi,airflowCmS:o.airflowCmS,temperatureC:o.temperatureC
      }));
      for(const m of inv.measurements) {
        if(/simulaci[oó]n/i.test(m.result))continue;
        rows.push({oxygenPercent:m.o2Initial===null?null:m.o2Initial*100,
          pressurePsi:m.pressure===null?null:m.pressure*atmospherePsi,
          airflowCmS:m.flow,temperatureC:m.temperature});
      }
      const metrics=Object.fromEntries((["oxygenPercent","pressurePsi","airflowCmS","temperatureC"] as NumericField[])
        .map(key=>[key,minmax(rows.map(r=>r[key]))]));
      return {
        id:inv.id,psiCode:inv.psiCode,shortName:inv.shortName,name:inv.name,agency:inv.agency,
        hardware:inv.hardware,hardwareRack:inv.hardwareRack,gravityRegime:inv.gravityRegime,laymanSummary:inv.laymanSummary,
        safetyDomain:inv.safetyDomain,platform:inv.platform,objectives:inv.objectives,fuel:inv.fuel,psiUrl:inv.psiUrl,
        metrics,observations:inv.normalizedObservations.length,registeredMeasurements:inv.measurements.length,
        series:inv.datasets.reduce((s,d)=>s+d._count.series,0),
        sourcePaths:[...new Set([...inv.normalizedObservations.map(o=>o.sourceAsset.sourcePath),...inv.datasets.map(d=>d.sourceAsset?.sourcePath||"").filter(Boolean)])].slice(0,15)
      };
    });
    if(profiles.some(p=>p===null))return NextResponse.json({error:"Falta una investigación de NASA PSI."},{status:404});
    return NextResponse.json({profiles,warning:"Cada rango proviene de las columnas disponibles de cada investigación; no representa un ensayo emparejado entre ambos experimentos. Oxígeno expresado en % y presión en psi. Las mediciones de catálogo pueden proceder de modelos."},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({error:"No se pudieron comparar las fuentes."},{status:500});}
}
