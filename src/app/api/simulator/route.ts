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
      // Ejes de series científicas no son condiciones ambientales emparejadas.
      // Por ejemplo, el eje de O₂ de CFI-G puede describir la corriente del
      // quemador y no el aire de cabina. Se muestran como relevancia temática,
      // pero nunca se usan para calcular similitud física con un hábitat.
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
