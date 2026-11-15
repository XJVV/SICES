"use client";
import * as React from "react";
import { Bot, Database, Download, RefreshCcw, ArrowLeftRight, ShieldCheck, Sparkles, Flame, Earth } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiAssistantPanel } from "./ai-assistant-panel";
import { useVisualizationMode } from "./visualization-mode";

type Inv={id:number;psiCode:string;shortName:string;name:string;agency:string;hardware:string;gravityRegime:string;laymanSummary:string;safetyDomain:string;objectives:string;description:string;fuel:string;psiUrl:string;_count:{datasets:number;measurements:number;normalizedObservations:number}};
type Scenario={key:string;name:string;o2:number;pressure:number;airflow:null;category:string;note:string;sourceUrl:string};
type Row={id:number;rowNumber:number;o2Percent:number|null;o2FinalPercent:number|null;pressurePsi:number|null;airflowCmS:number|null;temperatureC:number|null;sourceAsset:{agency:string;sourcePath:string}};
type Data={available:{agencies:{name:string}[];hardware:string[];gravity:string[]};investigations:Inv[];observations:Row[];scenarios:Scenario[];counts:{totalRows:number;sources:number;investigations:number};limits:{airflow:{min:number|null;max:number|null};pressure:{min:number|null;max:number|null}}};
type Match={investigationId:number;label:string;agency:string;distance:number|null;variables:number;sourcePath:string;kind:string;status:"CONDITIONS"|"PARTIAL"|"THEMATIC";matchedDimensions:string[];reason:string};
type Sim={matches:Match[];disclaimer:string};
type Metric="oxygenPercent"|"pressurePsi"|"airflowCmS"|"temperatureC";
type Range={min:number;max:number;count:number}|null;
type Profile={id:number;psiCode:string;shortName:string;laymanSummary:string;hardware:string;gravityRegime:string;objectives:string;safetyDomain:string;sourcePaths:string[];series:number;metrics:Record<Metric,Range>};
const fmt=(v:number|null|undefined)=>v===null||v===undefined?"Sin dato":v.toLocaleString("es-DO",{maximumFractionDigits:2});
function Picker({label,value,options,setValue}:{label:string;value:string;options:string[];setValue:(v:string)=>void}) {
 return <label className="block text-xs">{label}<select aria-label={label} className="mt-1 w-full rounded border bg-background p-2 text-sm" value={value} onChange={e=>setValue(e.target.value)}><option value="">Todos</option>{options.map(x=><option key={x} value={x}>{x}</option>)}</select></label>;
}
function Slide({label,value,min,max,onChange,help}:{label:string;value:number;min:number;max:number;onChange:(v:number)=>void;help:string}){
 return <div className="rounded border p-3"><label className="block text-sm">{label}: <strong>{fmt(value)}</strong><input type="range" min={min} max={max} step=".1" value={value} onChange={e=>onChange(Number(e.target.value))} className="mt-3 block w-full" /></label>
 <input className="mt-2 w-full rounded border bg-background p-1 text-xs" type="number" min={min} max={max} step=".1" value={value} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=min&&n<=max)onChange(n)}} aria-label={"Valor exacto de "+label}/><p className="mt-2 text-xs text-muted-foreground">{help}</p></div>;
}
function domain(s:string){return s==="PREVENTION"?"🛡️ Evitar incendios":s==="DETECTION"?"🔔 Descubrir el humo":s==="SUPPRESSION"?"🧯 Apagar el fuego":"🔬 Comprender la ciencia";}
function importance(s:string){return s==="PREVENTION"?"Ayuda a proteger la nave eligiendo materiales seguros.":s==="DETECTION"?"Permite investigar cómo avisar rápido si aparece humo.":s==="SUPPRESSION"?"Ayuda a investigar maneras de extinguir incendios.":"Ayuda a entender el fuego para cuidar a los astronautas.";}
function ComparePanel({investigations,educational}:{investigations:Inv[];educational:boolean}){
 const [left,setLeft]=React.useState("");
 const [right,setRight]=React.useState("");
 const [profiles,setProfiles]=React.useState<Profile[]>([]);
 const [warning,setWarning]=React.useState("");
 const [error,setError]=React.useState("");
 const keys:Metric[]=["oxygenPercent","pressurePsi","airflowCmS","temperatureC"];
 const names:Record<Metric,string>={oxygenPercent:"Oxígeno (%)",pressurePsi:"Presión (psi)",airflowCmS:"Aire (cm/s)",temperatureC:"Temperatura (°C)"};
 async function compare(){
   if(!left||!right||left===right)return;
   setError("");setProfiles([]);
   try{
    const r=await fetch("/api/compare?"+new URLSearchParams({a:left,b:right}).toString());
    const v=await r.json();
    if(!r.ok)throw Error(v.error||"Error al comparar");
    setProfiles(v.profiles);setWarning(v.warning);
   }catch(e){setError(e instanceof Error?e.message:"Error de comparación")}
 }
 return <section className="hud-panel space-y-4 p-5">
  <h3 className="flex items-center gap-2 font-bold"><ArrowLeftRight className="h-5 w-5 text-primary"/>{educational?"¡Dos experimentos cara a cara!":"Comparador científico NASA PSI"}</h3>
  <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
   <label className="text-xs">Primer experimento<select value={left} onChange={e=>setLeft(e.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Elegir</option>{investigations.map(i=><option key={i.id} value={i.id}>{i.shortName}</option>)}</select></label>
   <label className="text-xs">Segundo experimento<select value={right} onChange={e=>setRight(e.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Elegir</option>{investigations.map(i=><option key={i.id} value={i.id}>{i.shortName}</option>)}</select></label>
   <Button className="self-end" disabled={!left||!right||left===right} onClick={()=>void compare()}>Comparar</Button>
  </div>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {!!profiles.length&&<><p className="text-xs text-muted-foreground">{warning}</p><div className="grid gap-3 md:grid-cols-2">{profiles.map(i=><article key={i.id} className="rounded-lg border p-4">
    <p className="data-mono text-xs text-primary">{i.psiCode}</p><h4 className="font-bold">{i.shortName}</h4>
    <p className="my-3 text-sm">{educational?(i.laymanSummary||"Todavía no contamos con un resumen comprobado."):(i.objectives||"Objetivos no documentados")}</p>
    {educational&&<p className="mb-3 text-sm">{importance(i.safetyDomain)}</p>}
    <dl>{keys.map(key=><div key={key} className="flex justify-between gap-3 border-t py-2 text-xs"><dt>{names[key]}</dt><dd className="data-mono text-right">{i.metrics[key]?fmt(i.metrics[key]!.min)+" – "+fmt(i.metrics[key]!.max):"No medido"}</dd></div>)}</dl>
    {!educational&&<p className="mt-2 break-all text-xs text-muted-foreground">Hardware: {i.hardware||"N/D"} · Gravedad: {i.gravityRegime||"N/D"} · Series: {i.series} · Fuentes: {i.sourcePaths.slice(0,2).join("; ")||"Sin fuente asociada"}</p>}
   </article>)}</div></>}
 </section>;
}
export function ObservatoryView(){
 const {mode}=useVisualizationMode();const educational=mode==="educational";
 const [data,setData]=React.useState<Data|null>(null);
 const [error,setError]=React.useState("");
 const [agency,setAgency]=React.useState("");const [hardware,setHardware]=React.useState("");const [gravity,setGravity]=React.useState("");
 const [selected,setSelected]=React.useState<number|null>(null);
 const [preset,setPreset]=React.useState("earth");
 const [o2,setO2]=React.useState(21);const [pressure,setPressure]=React.useState(14.7);const [flow,setFlow]=React.useState<number|null>(null);
 const [sim,setSim]=React.useState<Sim|null>(null);
 const [simError,setSimError]=React.useState("");
 const [earthView,setEarthView]=React.useState(false);
 const load=React.useCallback(async()=>{
  try{
   const q=new URLSearchParams();if(agency)q.set("agency",agency);if(hardware)q.set("hardware",hardware);if(gravity)q.set("gravity",gravity);
   const r=await fetch("/api/observatory?"+q.toString(),{cache:"no-store"});
   const v=await r.json();if(!r.ok)throw Error(v.error||"Sin datos");
   setError("");setData(v);
  }catch(e){setError(e instanceof Error?e.message:"Error al leer SQLite")}
 },[agency,hardware,gravity]);
 React.useEffect(()=>{void load()},[load]);
 React.useEffect(()=>{
  const scenario=data?.scenarios.find(x=>x.key===preset);
  if(scenario){setO2(scenario.o2);setPressure(scenario.pressure);setFlow(null);}
 },[data?.scenarios,preset]);
 React.useEffect(()=>{
  if(!data)return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   try{
    const r=await fetch("/api/simulator",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({o2Percent:o2,pressurePsi:pressure,airflowCmS:flow}),signal:controller.signal});
    const v=await r.json();if(!r.ok)throw Error(v.error||"Error");
    setSimError("");setSim(v);
   }catch(e){if(!(e instanceof Error&&e.name==="AbortError"))setSimError(e instanceof Error?e.message:"Sin ranking")}
  },300);
  return ()=>{clearTimeout(timer);controller.abort()};
 },[data,o2,pressure,flow]);
 const chosen=data?.investigations.find(x=>x.id===selected);
 const moon=data?.scenarios.find(x=>x.key==="moon");
 const suit=data?.scenarios.find(x=>x.key==="spacesuit");
 const baseline=data?.scenarios.find(x=>x.key==="earth");
 const caution=o2>=(suit?.o2??101)?"Oxígeno puro: precaución máxima":o2>=(moon?.o2??101)?"Oxígeno enriquecido: más precaución":o2>(baseline?.o2??21)?"Más oxígeno que el aire de la Tierra":"Referencia terrestre";
 return <div className="space-y-6">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="display-title flex items-center gap-2 text-xl font-bold">{educational?<Sparkles className="h-5 w-5"/>:<Database className="h-5 w-5"/>}{educational?"¡Vamos a descubrir el fuego espacial!":"Observatorio científico · NASA PSI"}</h2>
   <p className="mt-2 text-sm text-muted-foreground">{educational?"Aprende por qué los astronautas estudian las llamas y cómo se cuidan.":"Conjuntos de NASA PSI con datos curados. JAXA y registros inutilizables fueron retirados."}</p></div>
   <div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCcw className="h-4 w-4"/>Actualizar</Button>{!educational&&<Button size="sm" variant="outline" asChild><a href="/api/observatory/export"><Download className="h-4 w-4"/>Exportar CSV</a></Button>}</div>
  </header>
  {error&&<p role="alert" className="rounded border p-3 text-sm text-destructive">{error}</p>}
  {data&&<>
   {educational?<section className="grid gap-3 md:grid-cols-3">
    <article className="hud-panel p-4"><Flame className="mb-2 h-7 w-7 text-orange-400"/><h3 className="font-bold">¿Qué pasa con la llama?</h3><p className="mt-2 text-sm">En la Tierra el aire caliente sube. En el espacio una llama puede verse más redonda.</p></article>
    <article className="hud-panel p-4"><ShieldCheck className="mb-2 h-7 w-7 text-green-400"/><h3 className="font-bold">¿Por qué nos importa?</h3><p className="mt-2 text-sm">Porque un incendio en una nave puede poner en peligro a los astronautas.</p></article>
    <article className="hud-panel p-4"><Sparkles className="mb-2 h-7 w-7 text-cyan-400"/><h3 className="font-bold">¿Qué podemos aprender?</h3><p className="mt-2 text-sm">A elegir materiales seguros, encontrar humo y apagar llamas.</p></article>
   </section>:<section className="grid gap-3 md:grid-cols-3">{[["Filas normalizadas",data.counts.totalRows],["Fuentes útiles",data.counts.sources],["Investigaciones NASA PSI",data.counts.investigations]].map(([name,n])=><article key={name} className="hud-panel p-4"><p className="text-xs text-muted-foreground">{name}</p><strong className="data-mono text-2xl">{Number(n).toLocaleString("es-DO")}</strong></article>)}</section>}
   <section className="hud-panel space-y-4 p-4">
    <h3 className="font-bold">{educational?"Elige una misión de investigación":"Investiga el catálogo"}</h3>
    <div className="grid gap-3 md:grid-cols-3">
     <Picker label="Agencia" value={agency} options={data.available.agencies.map(x=>x.name)} setValue={setAgency}/>
     <Picker label={educational?"Instrumento del estudio":"Hardware / Rack"} value={hardware} options={data.available.hardware} setValue={setHardware}/>
     <Picker label="Gravedad" value={gravity} options={data.available.gravity} setValue={setGravity}/>
    </div>
    <p className="text-xs text-muted-foreground">Solo aparecen fuentes realmente almacenadas. No se inventan resultados de otras agencias.</p>
    <div className="grid gap-3 md:grid-cols-2">{data.investigations.map(i=><article key={i.id} className="rounded-lg border p-4">
     <p className="data-mono text-xs text-primary">{i.psiCode} · {i.agency}</p><h4 className="font-bold">{i.shortName}</h4>
     {educational?<><p className="mt-2 text-sm">{i.laymanSummary||"Todavía no tenemos un resumen sencillo de esta investigación."}</p><div className="mt-3 rounded-md bg-muted/40 p-3"><strong className="text-sm">{domain(i.safetyDomain)}</strong><p className="mt-1 text-xs">{importance(i.safetyDomain)}</p></div><p className="mt-2 text-xs text-muted-foreground">Resumen en 30 segundos</p></>
     :<><p className="mt-2 text-xs">{i.objectives||"Objetivos no documentados"}</p><p className="mt-2 text-xs">Hardware: {i.hardware||"N/D"} · Gravedad: {i.gravityRegime||"N/D"} · Combustible: {i.fuel||"N/D"}</p><p className="mt-2 text-xs text-muted-foreground">Datasets: {i._count.datasets} · Mediciones: {i._count.measurements}</p></>}
     <Button className="mt-3" size="sm" variant="outline" onClick={()=>setSelected(i.id)}>{educational?"¡Cuéntame más!":"Contextualizar IA"}</Button>
    </article>)}</div>
    {!data.investigations.length&&<p>No hay investigaciones para los filtros elegidos.</p>}
    <AiAssistantPanel investigationId={selected} metric={null} seriesIds={[]} psiCode={chosen?.psiCode}/>
    {chosen&&<Button size="sm" variant="outline" onClick={()=>window.dispatchEvent(new CustomEvent("sices:ai-question",{detail:{question:"Explícame "+chosen.shortName+" de forma sencilla usando únicamente información verificada."}}))}><Bot className="h-4 w-4"/>Preguntar por {chosen.shortName}</Button>}
   </section>
   <section className="hud-panel space-y-4 p-5">
    <h3 className="font-bold">{educational?"¿Qué pasa si cambiamos el aire?":"Simulador de escenarios NASA"}</h3>
    <p className="text-xs text-muted-foreground">Los escenarios son referencias publicadas, no mediciones PSI. El ranking usa solo datos disponibles, no predice probabilidades de incendios.</p>
    <div className="grid gap-2 sm:grid-cols-4">{data.scenarios.map(s=><button key={s.key} type="button" aria-pressed={preset===s.key} onClick={()=>setPreset(s.key)} className={"rounded-md border p-3 text-left text-sm "+(preset===s.key?"border-primary bg-primary/10":"")}>
     <strong>{s.name}</strong><p className="mt-2 data-mono text-xs">{fmt(s.o2)}% O₂ · {fmt(s.pressure)} psi</p><p className="mt-1 text-xs text-muted-foreground">{s.category==="PROJECTED"?"Futuro ilustrativo":"Referencia"}</p>
    </button>)}</div>
    {preset&&<p className="text-xs text-muted-foreground">{data.scenarios.find(s=>s.key===preset)?.note} <a target="_blank" rel="noreferrer" className="underline" href={data.scenarios.find(s=>s.key===preset)?.sourceUrl}>Fuente</a></p>}
    <div className="grid gap-3 md:grid-cols-3">
     <Slide label={educational?"Oxígeno (%)":"Concentración O₂ (%)"} value={o2} min={0} max={100} onChange={n=>{setPreset("");setO2(n)}} help="Una concentración de 56 % se ve como 56, no 0.56."/>
     <Slide label={educational?"Presión del aire (psi)":"Presión absoluta (psi)"} value={pressure} min={0} max={Math.max(30,...data.scenarios.map(s=>s.pressure),data.limits.pressure.max??0)} onChange={n=>{setPreset("");setPressure(n)}} help="Todos los valores mostrados están en psi."/>
     <div className="rounded border p-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={flow!==null} onChange={e=>setFlow(e.target.checked?0:null)}/>Incluir velocidad del aire</label>
      {flow===null?<p className="mt-3 text-xs text-muted-foreground">Este escenario no especifica flujo: se omite al comparar.</p>:<Slide label="Flujo (cm/s)" value={flow} min={0} max={Math.max(50,data.limits.airflow.max??0)} onChange={n=>{setPreset("");setFlow(n)}} help="Se compara en cm/s cuando hay datos."/>}
     </div>
    </div>
    <div className="rounded border p-3"><strong>{educational?"¡Atención al oxígeno!":"Nivel orientativo de precaución por enriquecimiento de O₂"}</strong><p className="mt-1 text-sm">{caution}</p><meter min={0} max={100} value={o2} className="mt-2 w-full" aria-label="Concentración de oxígeno"/>
     <p className="text-xs text-muted-foreground">Esto NO es una escala certificada del riesgo de incendio. La presión, el combustible, el flujo y la gravedad también cambian el comportamiento del fuego.</p>
    </div>
    <h4 className="font-semibold">{educational?"Investigaciones que pueden ayudarnos":"Ranking de evidencia y condiciones"}</h4>
    {simError&&<p role="alert" className="text-sm text-destructive">{simError}</p>}
    <p className="text-xs text-muted-foreground">{sim?.disclaimer}</p>
    {sim?.matches.slice(0,15).map((m,n)=><div key={m.investigationId} className="rounded-md border p-3 text-sm"><strong>{n+1}. {m.label}</strong><span className="ml-2 text-xs text-muted-foreground">{m.status==="CONDITIONS"?"Condiciones comparadas":m.status==="PARTIAL"?"Datos parciales":"Solo relación temática"}</span>
     <p className="mt-2 text-xs">{educational?(m.status==="THEMATIC"?"Su investigación es relevante, pero falta información para decir si se parece a este lugar.":m.status==="PARTIAL"?"Hay algunos datos parecidos, aunque todavía no sabemos todas las condiciones.":"Tiene condiciones que podemos comparar.") :m.reason}</p>
     {!educational&&<p className="mt-1 data-mono break-all text-xs text-muted-foreground">{m.sourcePath} · Variables: {m.matchedDimensions.join(", ")||"ninguna"} · Distancia: {fmt(m.distance)}</p>}
    </div>)}
    {sim&&sim.matches.length===0&&<p className="text-sm">Sin resultados comparables.</p>}
   </section>
   <ComparePanel investigations={data.investigations} educational={educational}/>
   <section className="hud-panel space-y-3 p-5"><h3 className="flex items-center gap-2 font-bold"><Earth className="h-5 w-5"/> Espacio → Tierra</h3>
    <div className="flex gap-2"><Button size="sm" variant={earthView?"default":"outline"} onClick={()=>setEarthView(true)}>🌍 Tierra</Button><Button size="sm" variant={!earthView?"default":"outline"} onClick={()=>setEarthView(false)}>🛰️ Microgravedad</Button></div>
    <p className="rounded border p-4 text-sm">{earthView?"En la Tierra el aire caliente sube, por eso una vela suele tener una llama parecida a una lágrima.":"Sin corrientes de aire y con muy poca gravedad, la llama puede verse más redonda. El oxígeno llega por difusión; no todas las llamas son iguales."}</p>
    <p className="text-sm">Estos estudios ayudan a investigar mejores detectores de humo, métodos de extinción y materiales protectores. No se atribuye una invención terrestre concreta sin una fuente.</p>
    <a href="https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/" className="text-xs text-primary underline" target="_blank" rel="noreferrer">Fuente: NASA Space Apps 2026</a>
   </section>
   {!educational&&<section className="hud-panel space-y-3 p-5"><h3 className="font-bold">Observaciones y procedencia</h3>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{["Archivo / fila","O₂ inicial (%)","O₂ final (%)","Presión (psi)","Flujo (cm/s)","Temperatura (°C)"].map(k=><th key={k} className="p-2">{k}</th>)}</tr></thead>
    <tbody>{data.observations.map(r=><tr key={r.id} className="border-t"><td className="max-w-80 break-all p-2">{r.sourceAsset.sourcePath} · {r.rowNumber}</td><td className="p-2">{fmt(r.o2Percent)}</td><td className="p-2">{fmt(r.o2FinalPercent)}</td><td className="p-2">{fmt(r.pressurePsi)}</td><td className="p-2">{fmt(r.airflowCmS)}</td><td className="p-2">{fmt(r.temperatureC)}</td></tr>)}</tbody></table></div></section>}
  </>}
 </div>;
}
