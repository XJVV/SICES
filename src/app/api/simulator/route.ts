import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const requestSchema = z.object({
  o2Percent:z.number().finite().min(0).max(100),
  pressurePsi:z.number().finite().min(0).max(1000),
  airflowCmS:z.number().finite().min(0).max(100000).nullable().optional(),
});
type Dim = "o2Percent"|"pressurePsi"|"airflowCmS";
type Candidate = {o2Percent:number|null;pressurePsi:number|null;airflowCmS:number|null;sourcePath:string;kind:string};
type Match = {investigationId:number;label:string;psiCode:string;agency:string;distance:number|null;variables:number;sourcePath:string;kind:string;matchedDimensions:Dim[];missingDimensions:Dim[];status:"CONDITIONS"|"PARTIAL"|"THEMATIC"|"UNSUPPORTED";reason:string};
const atmosToPsi = 14.6959487755;
const barToPsi = 14.503773773;
function rangeValue(x: unknown): number|null { return typeof x==="number"&&Number.isFinite(x)?x:null; }
export async function POST(req:NextRequest) {
  const parsed = requestSchema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"O₂ debe estar en %, presión en psi y flujo en cm/s (opcional)."},{status:400});
  const q=parsed.data;
  const required:Dim[]=["o2Percent","pressurePsi"];
  if(q.airflowCmS!==null&&q.airflowCmS!==undefined)required.push("airflowCmS");
  try {
    const investigations=await db.investigation.findMany({
      where:{agency:"NASA_PSI"},
      select:{id:true,psiCode:true,shortName:true,agency:true,safetyDomain:true,
        normalizedObservations:{select:{o2Percent:true,pressurePsi:true,airflowCmS:true,sourceAsset:{select:{sourcePath:true}}},take:1000},
        datasets:{where:{sourceAsset:{agency:"NASA_PSI"}},select:{key:true,sourceAsset:{select:{sourcePath:true}},series:{where:{source:"EXPERIMENT"},select:{xKind:true,xUnit:true,pointsJson:true},take:500}},take:50}
      },
      orderBy:{psiCode:"asc"}
    });
    const result:Match[]=[];
    for(const inv of investigations) {
      const candidates:Candidate[] = inv.normalizedObservations.map(o=>({
        o2Percent:o.o2Percent,pressurePsi:o.pressurePsi,airflowCmS:o.airflowCmS,
        kind:"DATOS_CSV_XLSX",sourcePath:o.sourceAsset.sourcePath
      }));
      // The analyzed series are actual values, but O₂ and pressure in different
      // series cannot be treated as paired conditions of a single experiment.
      for(const dataset of inv.datasets) {
        if(!dataset.sourceAsset) continue;
        let extracted=0;
        for(const s of dataset.series) {
          if(extracted>=300)break;
          const isO2=s.xKind==="xo2" && s.xUnit==="-";
          const isPressure=s.xKind==="pressure_bar" && s.xUnit==="bar";
          if(!isO2&&!isPressure)continue;
          let points:unknown;
          try{points=JSON.parse(s.pointsJson)}catch{continue}
          if(!Array.isArray(points))continue;
          const xvals=[...new Set(points.map(p=>Array.isArray(p)?rangeValue(p[0]):null).filter((v):v is number=>v!==null))].slice(0,12);
          for(const x of xvals){
            candidates.push({
              o2Percent:isO2?x*100:null,
              pressurePsi:isPressure?x*barToPsi:null,
              airflowCmS:null,
              sourcePath:dataset.sourceAsset.sourcePath,
              kind:isO2?"O2_SERIE_CFI_G (mezcla o corriente del quemador)":"PRESION_SERIE_NASA",
            });
            extracted++;
          }
        }
      }
      let best:Match|null=null;
      for(const candidate of candidates){
        const matched=required.filter(dim=>candidate[dim]!==null);
        if(matched.length===0)continue;
        const scale:Record<Dim,number>={o2Percent:100,pressurePsi:14.7,airflowCmS:30};
        const distance=Math.sqrt(matched.reduce((sum,dim)=>{
          const value=candidate[dim];
          const target=dim==="airflowCmS"?(q.airflowCmS??0):q[dim];
          return sum+Math.pow(((value??0)-target)/scale[dim],2);
        },0)/matched.length);
        const rank=matched.length*10-distance;
        if(!best || rank>(best.variables*10-(best.distance??0))){
          best={
            investigationId:inv.id,label:inv.shortName,psiCode:inv.psiCode,agency:inv.agency,
            distance:Number(distance.toFixed(4)),variables:matched.length,sourcePath:candidate.sourcePath,
            kind:candidate.kind,matchedDimensions:matched,missingDimensions:required.filter(dim=>!matched.includes(dim)),
            status:matched.length===required.length?"CONDITIONS":"PARTIAL",
            reason:candidate.kind.startsWith("O2_SERIE")?"El O₂ corresponde a una serie CFI-G; podría ser corriente de quemador y no aire de cabina.":"Comparación de variables medidas disponibles; no implica límites de inflamabilidad.",
          };
        }
      }
      if(!best && inv.datasets.some(d=>d.series.length>0)){
        best={investigationId:inv.id,label:inv.shortName,psiCode:inv.psiCode,agency:inv.agency,
          distance:null,variables:0,sourcePath:"Series científicas del catálogo",kind:"RELEVANCIA_TEMATICA",
          matchedDimensions:[],missingDimensions:required,status:"THEMATIC",
          reason:"Investigación con series reales, pero sin condiciones de oxígeno/presión/flujo verificables para este entorno."};
      }
      if(best)result.push(best);
    }
    const rank={CONDITIONS:0,PARTIAL:1,THEMATIC:2,UNSUPPORTED:3};
    result.sort((a,b)=>rank[a.status]-rank[b.status]||b.variables-a.variables||(a.distance??Infinity)-(b.distance??Infinity)||a.label.localeCompare(b.label));
    return NextResponse.json({
      scenario:q,
      matches:result,
      comparedInvestigations:investigations.length,
      disclaimer:"Datos NASA PSI con archivo rastreable. Las coincidencias parciales NO demuestran compatibilidad; CFI-G puede medir O₂ del quemador, no de la cabina. No se calcula probabilidad de incendio."
    },{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({error:"No se pudo consultar condiciones. Revisa la base curada."},{status:500});
  }
}
