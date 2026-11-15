"use client";
import * as React from "react";
import { Database, Download, RefreshCcw, Search, SlidersHorizontal, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiAssistantPanel } from "./ai-assistant-panel";
import { useVisualizationMode } from "./visualization-mode";

type Source = {id:number;agency:string;sourcePath:string;status:string;warning:string;totalRows:number;normalizedRows:number};
type Investigation = {id:number;psiCode:string;shortName:string;name:string;agency:string;hardware:string;gravityRegime:string;laymanSummary:string;earthApplication:string;safetyDomain:string;objectives:string;description:string};
type Observation = {id:number;o2Percent:number|null;pressurePsi:number|null;airflowCmS:number|null;temperatureC:number|null;gravityRegime:string;hardware:string;environment:string;rowNumber:number;sourceAsset:{agency:string;sourcePath:string}};
type Scenario = {name:string;o2:number;pressure:number;airflow:number|null};
type Data = {counts:{totalRows:number;sources:number;investigations:number};available:{agencies:{name:string;files:number}[];hardware:string[];gravity:string[]};investigations:Investigation[];observations:Observation[];sources:Source[];scenarios:Scenario[];limits:{oxygen:{min:number|null;max:number|null};pressure:{min:number|null;max:number|null};airflow:{min:number|null;max:number|null}};warnings:string[]};
type Match = {id:number;investigationId:number|null;label:string;agency:string;sourcePath:string;distance:number;variables:number};
type Sim = {matches:Match[];comparedRows:number;disclaimer:string};
const fmt=(x:number|null|undefined)=>x == null ? "Sin dato" : x.toLocaleString("es-DO",{maximumFractionDigits:3});

function Choice({label,value,values,setValue}:{label:string;value:string;values:string[];setValue:(value:string)=>void}) {
  return <label className="flex flex-col gap-1 text-xs">{label}<select aria-label={label} value={value} onChange={e=>setValue(e.target.value)} className="rounded-md border bg-background p-2 text-sm">
    <option value="">Todos</option>{values.map(v=><option key={v} value={v}>{v}</option>)}
  </select></label>;
}
function Control({label,value,min,max,setValue}:{label:string;value:number|null;min:number|null;max:number|null;setValue:(v:number)=>void}){
  const low=min??0;const high=max??0;
  return <label className="flex flex-col gap-2 text-xs">{label}: <strong className="data-mono">{fmt(value)}</strong>
    <input type="range" disabled={value===null||high<=low} min={low} max={high} step="any" value={value??low} onChange={e=>setValue(Number(e.target.value))} aria-label={label} />
    <span className="text-muted-foreground">Rango documentado: {fmt(min)} – {fmt(max)}</span>
  </label>;
}
export function ObservatoryView() {
  const {mode}=useVisualizationMode();
  const [data,setData]=React.useState<Data|null>(null);
  const [error,setError]=React.useState("");
  const [agency,setAgency]=React.useState("");
  const [hardware,setHardware]=React.useState("");
  const [gravity,setGravity]=React.useState("");
  const [selected,setSelected]=React.useState<number|null>(null);
  const [oxygen,setOxygen]=React.useState<number|null>(null);
  const [pressure,setPressure]=React.useState<number|null>(null);
  const [airflow,setAirflow]=React.useState<number|null>(null);
  const [sim,setSim]=React.useState<Sim|null>(null);
  const [simError,setSimError]=React.useState("");
  const [loading,setLoading]=React.useState(false);
  const fetchData=React.useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const query=new URLSearchParams();
      if(agency)query.set("agency",agency);
      if(hardware)query.set("hardware",hardware);
      if(gravity)query.set("gravity",gravity);
      if(selected)query.set("investigationId",String(selected));
      const response=await fetch("/api/observatory?"+query.toString(),{cache:"no-store"});
      if(!response.ok)throw Error("No fue posible consultar SQLite. Primero ejecuta la migración y la ingesta.");
      const result=await response.json() as Data;
      setData(result);
      setOxygen(v=>v??result.limits.oxygen.min);
      setPressure(v=>v??result.limits.pressure.min);
      setAirflow(v=>v??result.limits.airflow.min);
    }catch(e){setError(e instanceof Error?e.message:"Error de consulta");}
    finally{setLoading(false)}
  },[agency,hardware,gravity,selected]);
  React.useEffect(()=>{void fetchData()},[fetchData]);
  async function simulate(){
    if(oxygen==null||pressure==null||airflow==null)return;
    setSim(null);setSimError("");
    try{
      const response=await fetch("/api/simulator",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({o2Percent:oxygen,pressurePsi:pressure,airflowCmS:airflow})});
      const value=await response.json();
      if(!response.ok)throw Error(value.error||"Error al comparar");
      setSim(value as Sim);
    }catch(e){setSimError(e instanceof Error?e.message:"Error de comparación");}
  }
  function ask(text:string){window.dispatchEvent(new CustomEvent("sices:ai-question",{detail:{question:text}}));}
  const chosen=data?.investigations.find(x=>x.id===selected)??null;
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="display-title flex items-center gap-2 text-xl font-bold"><Database className="h-5 w-5 text-primary"/>Observatorio de combustión espacial</h2>
        <p className="mt-1 text-sm text-muted-foreground">Datos precargados con procedencia auditable. No existe carga de archivos desde el navegador.</p></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>void fetchData()} disabled={loading}><RefreshCcw className="h-4 w-4"/>Actualizar</Button>
        <Button variant="outline" size="sm" asChild><a href={"/api/observatory/export"+(agency?"?agency="+encodeURIComponent(agency):"")}><Download className="h-4 w-4"/>Exportar</a></Button></div>
    </header>
    {error&&<p role="alert" className="border border-destructive/40 rounded p-3 text-sm">{error}</p>}
    {data&&<>
      <section className="grid gap-3 sm:grid-cols-3">
        {[["Observaciones",data.counts.totalRows],["Fuentes listadas",data.counts.sources],["Investigaciones",data.counts.investigations]].map(([label,count])=><article key={label} className="hud-panel p-4"><p className="text-xs text-muted-foreground">{label}</p><strong className="data-mono text-2xl">{Number(count).toLocaleString()}</strong></article>)}
      </section>
      <section className="hud-panel space-y-3 p-4"><h3 className="flex items-center gap-2 font-semibold"><Search className="h-4 w-4"/>Explorar investigaciones</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <Choice label="Agencia" value={agency} setValue={setAgency} values={data.available.agencies.map(x=>x.name)}/>
          <Choice label="Hardware / rack" value={hardware} setValue={setHardware} values={data.available.hardware}/>
          <Choice label="Gravedad" value={gravity} setValue={setGravity} values={data.available.gravity}/>
          <label className="flex flex-col gap-1 text-xs">Investigación<select className="rounded-md border bg-background p-2 text-sm" value={selected??""} onChange={e=>setSelected(e.target.value?Number(e.target.value):null)}>
            <option value="">Todas</option>{data.investigations.map(x=><option value={x.id} key={x.id}>{x.psiCode} · {x.shortName}</option>)}
          </select></label>
        </div>
        <p className="text-xs text-muted-foreground">Se muestran únicamente categorías presentes en las fuentes almacenadas; la ausencia de valores no se interpreta como resultado negativo.</p>
      </section>
      <section className="hud-panel space-y-3 p-4">
        <h3 className="font-semibold">{mode==="educational"?"Resumen en 30 segundos":"Ficha científica con trazabilidad"}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {data.investigations.slice(0,24).map(inv=><article key={inv.id} className="rounded-md border p-3 text-sm">
            <p className="data-mono text-xs text-primary">{inv.psiCode} · {inv.agency||"Agencia no documentada"}</p>
            <h4 className="font-semibold">{inv.name}</h4>
            <p className="mt-2">{mode==="educational"?(inv.laymanSummary||"El dataset no contiene un resumen divulgativo verificable."):(inv.objectives||inv.description||"Objetivos no documentados en los datos.")}</p>
            <p className="mt-2 text-xs text-muted-foreground">{mode==="educational"?"Seguridad: "+(inv.safetyDomain||"No clasificada"):"Hardware: "+(inv.hardware||"No documentado")+" · Gravedad: "+(inv.gravityRegime||"No documentada")}</p>
            {mode==="educational"&&<p className="mt-2 text-xs">Espacio → Tierra: {inv.earthApplication||"Sin aplicación terrestre comprobada en la fuente."}</p>}
            <Button variant="link" size="sm" onClick={()=>{setSelected(inv.id);ask("Explica el experimento "+inv.psiCode+" usando solo fuentes verificables de la base de datos.")}}><Bot className="h-3.5 w-3.5"/>Consultar a la IA</Button>
          </article>)}
        </div>
        {data.investigations.length===0&&<p className="text-sm">No hay investigaciones asociadas a los filtros seleccionados.</p>}
        <AiAssistantPanel investigationId={selected} metric={null} seriesIds={[]} psiCode={chosen?.psiCode}/>
      </section>
      <section className="hud-panel space-y-4 p-4">
        <h3 className="flex items-center gap-2 font-semibold"><SlidersHorizontal className="h-4 w-4"/>Simulador exploratorio de entornos habitables</h3>
        <p className="text-xs text-muted-foreground">Los límites proceden de mediciones de SQLite. Esta herramienta ordena similitud, no predice inflamabilidad ni propone niveles de seguridad certificados.</p>
        {data.scenarios.length>0&&<Choice label="Entorno documentado" value="" values={data.scenarios.map(x=>x.name)} setValue={name=>{
          const s=data.scenarios.find(x=>x.name===name);if(!s)return;
          setOxygen(s.o2);setPressure(s.pressure);setAirflow(s.airflow);
        }}/>}
        <div className="grid gap-4 md:grid-cols-3">
          <Control label="Oxígeno (%)" value={oxygen} min={data.limits.oxygen.min} max={data.limits.oxygen.max} setValue={setOxygen}/>
          <Control label="Presión (psi)" value={pressure} min={data.limits.pressure.min} max={data.limits.pressure.max} setValue={setPressure}/>
          <Control label="Flujo de aire (cm/s)" value={airflow} min={data.limits.airflow.min} max={data.limits.airflow.max} setValue={setAirflow}/>
        </div>
        <Button disabled={oxygen==null||pressure==null||airflow==null} onClick={()=>void simulate()}>Comparar experimentos compatibles</Button>
        {simError&&<p role="alert" className="text-sm text-destructive">{simError}</p>}
        {sim&&<div className="space-y-2"><p className="text-xs text-muted-foreground">{sim.disclaimer}</p>
          <p className="text-xs">Filas examinadas: {sim.comparedRows.toLocaleString()}</p>
          {sim.matches.map((m,i)=><p key={m.id} className="rounded border p-2 text-xs">{i+1}. {m.label} · {m.agency} · {m.variables} variables comparables · distancia normalizada {fmt(m.distance)} <span className="text-muted-foreground">({m.sourcePath})</span></p>)}
          {!sim.matches.length&&<p className="text-sm">No hay registros compatibles con valores numéricos interpretables.</p>}
        </div>}
      </section>
      <section className="hud-panel space-y-3 p-4">
        <h3 className="font-semibold">Registros científicos y procedencia</h3>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Agencia / Archivo</th><th className="p-2">O₂ (%)</th><th className="p-2">Presión (psi)</th><th className="p-2">Flujo (cm/s)</th><th className="p-2">Temperatura (°C)</th></tr></thead>
          <tbody>{data.observations.map(r=><tr key={r.id} className="border-t"><td className="p-2">{r.sourceAsset.agency}<p className="max-w-60 truncate text-muted-foreground" title={r.sourceAsset.sourcePath}>{r.sourceAsset.sourcePath} · fila {r.rowNumber}</p></td><td className="p-2">{fmt(r.o2Percent)}</td><td className="p-2">{fmt(r.pressurePsi)}</td><td className="p-2">{fmt(r.airflowCmS)}</td><td className="p-2">{fmt(r.temperatureC)}</td></tr>)}</tbody>
        </table></div>
        {data.warnings.map((w,i)=><p key={i} className="text-xs text-muted-foreground">{w}</p>)}
        <details><summary className="cursor-pointer text-sm">Archivos de origen ({data.sources.length} visibles)</summary>
          <div className="mt-2 max-h-72 overflow-auto">{data.sources.map(s=><p className="border-b py-1 text-xs" key={s.id}>{s.agency} · {s.status} · {s.sourcePath} ({s.normalizedRows} filas reconocidas) {s.warning}</p>)}</div>
        </details>
      </section>
    </>}
  </div>;
}
