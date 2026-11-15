"use client";

import * as React from "react";
import { Activity, ArrowDownToLine, ArrowUpRight, BookOpen, ChartNoAxesCombined, CircleHelp, Database, FileSpreadsheet, Fingerprint, FlaskConical, GitCompareArrows, Layers, LoaderCircle, Microscope, Search, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis, Brush, Legend } from "recharts";
import { AiAssistantPanel } from "@/components/system/ai-assistant-panel";
import { RawPSIExplorer } from "./psi-raw-explorer";
import { useSicesPreferences } from "./user-preferences";

export type PsiInvestigation = {
 id:number;psiCode:string;shortName:string;name:string;agency:string;hardware:string;hardwareRack:string;
 gravityRegime:string;laymanSummary:string;safetyDomain:string;objectives:string;description:string;results:string;
 fuel:string;oxygen:string;pressure:string;flow:string;psiUrl:string;platform:string;
 _count:{datasets:number;measurements:number;normalizedObservations:number};
};
export type PsiScenario={key:string;name:string;o2:number;pressure:number;gravity:string;category:string;note:string;sourceUrl:string};
export type PsiData={
 counts:{totalRows:number;sources:number;investigations:number};
 available:{hardware:string[];gravity:string[]};
 investigations:PsiInvestigation[];
 observations:{id:number;rowNumber:number;o2Percent:number|null;o2FinalPercent:number|null;pressurePsi:number|null;airflowCmS:number|null;temperatureC:number|null;sourceAsset:{sourcePath:string}}[];
 sources:{id:number;sourcePath:string;normalizedRows:number;status:string}[];
 scenarios:PsiScenario[];
 limits:{oxygen:{min:number|null;max:number|null};pressure:{min:number|null;max:number|null};airflow:{min:number|null;max:number|null}};
};
type ExperimentalSeries={
 id:number;metric:string;xKind:string;xUnit:string;yUnit:string;label:string;source:"EXPERIMENT";
 points:number[][];rawPointCount?:number;decimated?:boolean;
};
type Dataset={
 id:number;key:string;investigationId:number;investigation:{id:number;psiCode:string;shortName:string;name:string;combustionType:string};
 nameEs:string;nameEn:string;tag:string;fuel:string;condition:string;doi:string;reference:string;
 provenance:{agency:string;sourcePath:string;sha256:string};
 series:ExperimentalSeries[];
};
type Curve={dataset:Dataset;series:ExperimentalSeries};
type Match={investigationId:number;label:string;psiCode:string;status:"CONDITIONS"|"PARTIAL"|"THEMATIC";distance:number|null;variables:number;matchedDimensions:string[];missingDimensions:string[];sourcePath:string;reason:string};
type Simulation={matches:Match[];disclaimer:string;comparedInvestigations:number};
type Profile={id:number;psiCode:string;shortName:string;name:string;agency:string;hardware:string;gravityRegime:string;objectives:string;laymanSummary:string;sourcePaths:string[];series:number;metrics:Record<"oxygenPercent"|"pressurePsi"|"airflowCmS"|"temperatureC",{min:number;max:number;count:number}|null>};
const palette=["#7dd3fc","#fbbf24","#5eead4","#f472b6","#c4b5fd","#fb923c"];
const fmt=(n:number|null|undefined,digits=3)=>typeof n==="number"&&Number.isFinite(n)?n.toLocaleString("es-DO",{maximumFractionDigits:digits}):"N/D";
const labelMetric=(key:string)=>({
 d2:"Diámetro² de la gota",diameter:"Diámetro de gota",dflame:"Diámetro de llama",radiance:"Radiancia",
 tmax:"Temperatura máxima",k:"Constante K",hcrate_o2:"Caudal de combustible vs O₂",
 hcrate_p:"Caudal de combustible vs presión",burntime_o2:"Tiempo de combustión vs O₂",
 burntime_p:"Tiempo de combustión vs presión",xo2_after_o2:"O₂ al final vs O₂ al inicio",
 peaktemp_o2:"Temperatura máxima vs O₂",peaktemp_p:"Temperatura máxima vs presión",
 dext_cf_do:"Extinción de llama fría vs diámetro",dext_hf_do:"Extinción de llama caliente vs diámetro",
 coolflame_dia:"Diámetro de llama fría"
} as Record<string,string>)[key]||key.replace(/_/g," ");
function compatKey(s:ExperimentalSeries){return [s.metric,s.xKind,s.xUnit,s.yUnit].join("|")}
function xUnit(s:ExperimentalSeries){
 if(s.xKind==="xo2"&&s.xUnit==="-")return "% O₂ (en el ensayo)";
 if(s.xKind==="pressure_bar"||s.xKind==="pressure_atm")return "psi";
 return s.xUnit&&s.xUnit!=="-"?s.xUnit:"sin unidad";
}
function yUnit(s:ExperimentalSeries){
 if(s.metric.startsWith("xo2_after_")&&s.yUnit==="-")return "% O₂ final";
 return s.yUnit&&s.yUnit!=="-"?s.yUnit:"adimensional";
}
function xValue(x:number,s:ExperimentalSeries){
 if(s.xKind==="xo2"&&s.xUnit==="-")return x*100;
 if(s.xKind==="pressure_bar"&&s.xUnit==="bar")return x*14.503773773;
 if(s.xKind==="pressure_atm"&&s.xUnit==="atm")return x*14.6959487755;
 return x;
}
function yValue(y:number,s:ExperimentalSeries){
 if(s.metric.startsWith("xo2_after_")&&s.yUnit==="-")return y*100;
 return y;
}
function plotted(curve:Curve){
 return curve.series.points.filter(p=>p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]))
   .map(p=>({x:xValue(p[0],curve.series),y:yValue(p[1],curve.series)}));
}
function sourceHref(path:string){return "https://github.com/XJVV/SICES/blob/feature/sices-nasa-evolution/cvs/"+path.replace(/^NASA_PSI\//,"NASA_PSI/").split("/").map(encodeURIComponent).join("/")}
function tag(text:string,tone:"cyan"|"amber"|"green"="cyan"){return <span className={"rounded-full border px-2.5 py-1 text-[11px] font-semibold "+(tone==="cyan"?"border-sky-300/25 bg-sky-400/10 text-sky-200":tone==="amber"?"border-amber-300/25 bg-amber-300/10 text-amber-200":"border-emerald-300/25 bg-emerald-300/10 text-emerald-200")}>{text}</span>}
function ScientificChart({curves}:{curves:Curve[]}){
 const {t}=useSicesPreferences();
 const points=React.useMemo(()=>{
   const table=new Map<number,Record<string,number>>();
   for(const c of curves)for(const p of plotted(c)){
     const x=Number(p.x.toFixed(8));
     const row=table.get(x)||{x};row["p"+c.series.id]=p.y;table.set(x,row);
   }
   return [...table.values()].sort((a,b)=>a.x-b.x);
 },[curves]);
 const first=curves[0];
 const peak=React.useMemo(()=>{
   if(!first)return null;
   const arr=plotted(first);
   if(!arr.length)return null;
   return arr.reduce((m,p)=>p.y>m.y?p:m,arr[0]);
 },[first]);
 if(!first||!points.length)return <div className="flex h-[330px] items-center justify-center rounded-2xl border border-white/10 text-sm text-slate-400">No se encontraron puntos experimentales interpretables.</div>;
 const ykeys=curves.map(c=>c.series.id);
 const colors=curves.map((c,i)=>palette[i%palette.length]);
 return <div className="rounded-2xl border border-white/10 bg-[#081729] p-3 sm:p-5">
   <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-300">Eje X: {xUnit(first.series)} · Eje Y: {yUnit(first.series)}</span>{tag("CURVAS NASA PSI","green")}</div>
   <div className="h-[330px] w-full sm:h-[420px]"><ResponsiveContainer width="100%" height="100%">
     <ComposedChart data={points} margin={{top:28,right:18,bottom:14,left:0}}>
       <CartesianGrid stroke="rgba(148,163,184,.12)" strokeDasharray="4 4"/>
       <XAxis type="number" dataKey="x" domain={["dataMin","dataMax"]} tick={{fill:"#a3b5c9",fontSize:11}} tickFormatter={v=>fmt(Number(v),2)} stroke="#33465c"/>
       <YAxis tick={{fill:"#a3b5c9",fontSize:11}} tickFormatter={v=>fmt(Number(v),2)} width={62} stroke="#33465c" domain={["auto","auto"]}/>
       <Tooltip contentStyle={{background:"#0c2034",border:"1px solid rgba(148,163,184,.25)",color:"#e2e8f0",borderRadius:12}} labelFormatter={x=>"X = "+fmt(Number(x),3)+" "+xUnit(first.series)} formatter={(value,name)=>[fmt(Number(value),4)+" "+yUnit(first.series),String(name)]}/>
       {curves.map((c,i)=><Line key={c.series.id} dataKey={"p"+c.series.id} name={c.dataset.investigation.shortName+" • "+c.series.label} type="linear" connectNulls stroke={colors[i]} strokeWidth={i===0?2.8:2} dot={points.length<30} activeDot={{r:5}} isAnimationActive={false}/>)}
       {peak&&<ReferenceDot x={peak.x} y={peak.y} r={5} fill="#fbbf24" stroke="#111827" strokeWidth={2} label={{value:"Máximo registrado",position:"top",fill:"#fbbf24",fontSize:11}}/>}
       {points.length>40&&<Brush dataKey="x" height={18} stroke="#7dd3fc" travellerWidth={8} tickFormatter={v=>fmt(Number(v),2)} fill="#081729"/>}
     </ComposedChart>
   </ResponsiveContainer></div>
   {peak&&<p className="mt-3 rounded-lg bg-amber-300/[.07] p-3 text-xs text-slate-300"><strong className="text-amber-200">Marcador real:</strong> el máximo {fmt(peak.y)} {yUnit(first.series)} aparece en X = {fmt(peak.x)} {xUnit(first.series)}, sobre un punto de la primera serie. <strong>No indica ignición, extinción ni llama fría</strong> sin un evento etiquetado en la fuente.</p>}
   <div className="mt-3 flex flex-wrap gap-3 text-xs">{curves.map((c,i)=><span key={c.series.id} className="flex items-center gap-2 text-slate-300"><span className="h-2 w-2 rounded-full" style={{backgroundColor:colors[i]}}/>{c.dataset.investigation.shortName} · {c.series.label}</span>)}</div>
 </div>;
}

function DataExplorer({catalog,curves,onFocus,focus}:{catalog:PsiInvestigation[];curves:Curve[];onFocus:(psi:string)=>void;focus:string}) {
 const {t}=useSicesPreferences();
 const [rawCounts,setRawCounts]=React.useState<Record<string,{csvTables:number;readableCSV:number;totalFiles:number}>>({});
 React.useEffect(()=>{
  const ctrl=new AbortController();
  fetch("/api/psi-raw",{cache:"no-store",signal:ctrl.signal})
    .then(async r=>{if(!r.ok)return;const data=await r.json();const dict:Record<string,{csvTables:number;readableCSV:number;totalFiles:number}>={};for(const a of data.studies||[])dict[a.code]=a;setRawCounts(dict)})
    .catch(()=>{});
  return()=>ctrl.abort();
 },[]);
 React.useEffect(()=>{setPsi(focus);setMetric("");setActiveIds([])},[focus]);
 const [search,setSearch]=React.useState("");
 const [psi,setPsi]=React.useState(focus);
 const [metric,setMetric]=React.useState("");
 const [activeIds,setActiveIds]=React.useState<number[]>([]);
 const studies=React.useMemo(()=>catalog.filter(i=>(i.shortName+" "+i.psiCode+" "+i.name).toLowerCase().includes(search.toLowerCase())),[catalog,search]);
 const all=React.useMemo(()=>psi?curves.filter(c=>c.dataset.investigation.psiCode===psi):curves,[curves,psi]);
 const groups=React.useMemo(()=>{
   const m=new Map<string,Curve[]>();for(const c of all){const key=compatKey(c.series);m.set(key,[...(m.get(key)||[]),c])}
   return [...m.entries()].sort((a,b)=>b[1].length-a[1].length);
 },[all]);
 const current=(groups.find(([key])=>key===metric)||groups[0]);
 const selected=React.useMemo(()=>{
   if(!current)return [];
   const given=current[1].filter(c=>activeIds.includes(c.series.id));
   return (given.length?given:current[1]).slice(0,5);
 },[current,activeIds]);
 const first=selected[0];
 return <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
  <aside className="sices-glass flex h-fit flex-col gap-4 p-4">
    <div><p className="sices-kicker">{t("EXPERIMENTOS NASA PSI","NASA PSI EXPERIMENTS")}</p><label className="relative mt-3 block"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="BASS, FLEX, CFI-G…" className="sices-input sices-search-input" aria-label={t("Buscar experimento","Search experiment")}/></label></div>
    <div className="max-h-[410px] space-y-1 overflow-y-auto pr-1"><button className={"sices-study "+(!psi?"sices-study-active":"")} onClick={()=>{setPsi("");setMetric("");setActiveIds([])}}>{t("Todas las curvas experimentales","All experimental curves")} <span>{curves.length}</span></button>
    {studies.map(i=>{const n=curves.filter(c=>c.dataset.investigation.psiCode===i.psiCode).length;const raw=rawCounts[i.psiCode];return <button key={i.id} className={"sices-study "+(psi===i.psiCode?"sices-study-active":"")} onClick={()=>{setPsi(i.psiCode);setMetric("");setActiveIds([]);onFocus(i.psiCode)}}><span>{i.shortName}<small>{i.psiCode}</small></span><span className="text-right"><strong className="block">{n?String(n)+" "+t("curvas","curves"):""}</strong><small className="block">{raw?.csvTables?raw.csvTables+" "+t("tablas","tables"):raw?.totalFiles?raw.totalFiles+" "+t("archivos","files"):!n?t("Sin datos tabulados","No tabular data"):""}</small></span></button>})}</div>
    <p className="text-[11px] leading-relaxed text-slate-400">{t("Las tablas de ensayos originales pueden tener datos aunque no existan curvas. Selecciona un estudio para ver sus archivos.","Original test tables may contain data even when no curves exist. Select a study to see the files.")}</p>
  </aside>
  <div className="min-w-0 space-y-5">
   <section className="sices-glass p-5 sm:p-6">
    <div className="flex flex-wrap justify-between gap-3"><div><p className="sices-kicker">{t("DATOS EXPERIMENTALES REALES","REAL EXPERIMENTAL DATA")}</p><h3 className="mt-2 text-2xl font-bold">{t("Explorador de curvas","Curve explorer")}</h3></div>{tag(curves.length+" "+t("series experimentales con archivo","source-backed experimental series"),"green")}</div>
    <p className="mt-2 text-sm leading-relaxed text-slate-400">{t("Solo puntos asociados a archivos NASA PSI identificados. No se incluyen series de modelos, simulaciones ni cifras de demostración.","Only data associated with traceable NASA PSI source files. No models, simulated points or demonstration values.")}</p>
    {current?<div className="mt-5 space-y-3">
      <label className="block text-xs font-semibold text-slate-300">Qué variable quieres investigar
       <select className="sices-input mt-2" value={current[0]} onChange={e=>{setMetric(e.target.value);setActiveIds([])}}>
        {groups.map(([key,g])=><option key={key} value={key}>{labelMetric(g[0].series.metric)} · {xUnit(g[0].series)} → {yUnit(g[0].series)} ({g.length} {t("series","series")})</option>)}
       </select>
      </label>
      <p className="text-xs text-slate-400">{t("Las curvas solo se superponen cuando coinciden métrica, variable X y unidades originales. Selecciona hasta cinco.","Curves are overlaid only when the metric, X axis and original units match. Choose up to five.")}</p>
      <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">{current[1].slice(0,40).map((c,i)=>{
       const active=activeIds.length?activeIds.includes(c.series.id):i<5;
       return <button type="button" key={c.series.id} onClick={()=>{const existing=activeIds.length?activeIds:current[1].slice(0,5).map(x=>x.series.id);setActiveIds(active?existing.filter(id=>id!==c.series.id):[...existing,c.series.id].slice(-5))}} className={"rounded-lg border px-3 py-1.5 text-[11px] "+(active?"border-sky-300/40 bg-sky-300/10 text-sky-200":"border-white/10 text-slate-400")}>{c.dataset.investigation.shortName} · {c.series.label}</button>;
      })}</div>
    </div>:<div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-6 text-sm text-slate-300"><strong>{t("Sin curvas experimentales importadas para este filtro.","No experimental curves imported for this filter.")}</strong> El estudio puede estar documentado, pero no inventamos puntos ni rellenamos sus ejes. Selecciona otro experimento.</div>}
   </section>
   {selected.length>0&&<ScientificChart curves={selected}/>}
   {first&&<section className="sices-glass space-y-4 p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-2 text-lg font-bold"><Fingerprint size={19} className="text-sky-300"/> Huella de datos</h4><a className="sices-ctl" href={"/api/series/export?seriesId="+first.series.id}><ArrowDownToLine size={15}/> CSV con todos los puntos</a></div>
    <div className="grid gap-3 text-sm sm:grid-cols-3"><div><span className="sices-kicker">{t("INVESTIGACIÓN","INVESTIGATION")}</span><p className="mt-1 font-semibold">{first.dataset.investigation.shortName} · {first.dataset.investigation.psiCode}</p></div><div><span className="sices-kicker">{t("PUNTOS","POINTS")}</span><p className="mt-1 font-semibold">{fmt(first.series.rawPointCount||first.series.points.length)} {t("originales","original")} {first.series.decimated?t("• visualización reducida","• downsampled chart"):""}</p></div><div><span className="sices-kicker">{t("ESTADO","STATUS")}</span><p className="mt-1 font-semibold text-emerald-300">EXPERIMENT / NASA PSI</p></div></div>
    <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950/30 p-3 text-xs"><p className="font-semibold text-slate-200">{t("Archivo de origen","Source file")}</p><a className="break-all text-sky-300 underline" target="_blank" rel="noopener noreferrer" href={sourceHref(first.dataset.provenance.sourcePath)}>{first.dataset.provenance.sourcePath} <ArrowUpRight size={12} className="inline"/></a><p className="break-all text-[10px] text-slate-500">SHA-256: {first.dataset.provenance.sha256}</p>{first.dataset.doi&&<a className="text-amber-200 underline" href={"https://doi.org/"+encodeURIComponent(first.dataset.doi)} target="_blank" rel="noopener noreferrer">DOI: {first.dataset.doi}</a>}</div>
    <h5 className="text-sm font-semibold">{t("Puntos visibles de la primera serie — sin interpolación","First series: visible points without interpolation")}</h5>
    <div className="max-h-52 overflow-auto rounded-lg border border-white/10"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[#102338] text-slate-200"><tr><th className="px-3 py-2">X ({xUnit(first.series)})</th><th className="px-3 py-2">Y ({yUnit(first.series)})</th><th className="px-3 py-2">{t("Tipo","Type")}</th></tr></thead><tbody>{plotted(first).slice(0,35).map((p,i)=><tr key={i} className="border-t border-white/10"><td className="px-3 py-2">{fmt(p.x,6)}</td><td className="px-3 py-2">{fmt(p.y,6)}</td><td className="px-3 py-2 text-emerald-300">{t("Medición","Measurement")}</td></tr>)}</tbody></table></div>
    {first.series.points.length>35&&<p className="text-xs text-slate-400">{t("Se muestra una muestra de 35 puntos; descarga el CSV para ver todos los puntos originales.","The first 35 points are displayed. Download the CSV to see all original points.")}</p>}
   </section>}
  {psi&&<RawPSIExplorer code={psi}/>}
  </div>
 </div>;
}

function ScenarioLab({data}:{data:PsiData}) {
 const {t,language}=useSicesPreferences();
 const initial=data.scenarios.find(s=>s.key==="earth");
 const [preset,setPreset]=React.useState("earth");
 const [o2,setO2]=React.useState(initial?.o2||21);
 const [pressure,setPressure]=React.useState(initial?.pressure||14.7);
 const [flow,setFlow]=React.useState<number|null>(null);
 const [answer,setAnswer]=React.useState<Simulation|null>(null);
 const [pending,setPending]=React.useState(false);
 const [error,setError]=React.useState("");
 const presetChoice=(s:PsiScenario)=>{setPreset(s.key);setO2(s.o2);setPressure(s.pressure);setFlow(null)};
 React.useEffect(()=>{
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setPending(true);
   try{
    const r=await fetch("/api/simulator",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({o2Percent:o2,pressurePsi:pressure,airflowCmS:flow}),signal:controller.signal});
    const v=await r.json();if(!r.ok)throw Error(v.error||"No se pudo comparar");
    setAnswer(v);setError("");
   }catch(e){if(!(e instanceof Error&&e.name==="AbortError"))setError(e instanceof Error?e.message:"Error")}
   finally{if(!controller.signal.aborted)setPending(false)}
  },330);
  return()=>{controller.abort();clearTimeout(timer)};
 },[o2,pressure,flow]);
 return <div className="space-y-6">
  <section className="sices-glass p-5 sm:p-7">
   <span className="sices-kicker">{t("ANÁLISIS DE ESCENARIOS","SCENARIO ANALYSIS")}</span><h3 className="mt-2 text-3xl font-bold">{t("¿Qué investigaciones se parecen a estas condiciones?","Which studies resemble these conditions?")}</h3>
   <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">Elegir condiciones no calcula un incendio. Los escenarios son referencias de misión y el ranking muestra <strong className="text-slate-200">{t("coincidencia de variables","matching variables")}</strong> cuando un archivo NASA PSI lo permite.</p>
   <div className="mt-6 grid gap-3 sm:grid-cols-4">{data.scenarios.map(s=><button type="button" key={s.key} onClick={()=>presetChoice(s)} className={"rounded-xl border px-4 py-4 text-left transition-colors "+(preset===s.key?"border-amber-300/50 bg-amber-300/10":"border-white/10 bg-white/[.03] hover:bg-white/[.07]")}><p className="font-bold">{s.name}</p><p className="mt-2 text-sm text-amber-200">{fmt(s.o2)}% O₂</p><p className="text-xs text-slate-400">{fmt(s.pressure)} psi</p></button>)}</div>
   <p className="mt-3 text-xs text-slate-400">{data.scenarios.find(s=>s.key===preset)?.note||"Condiciones ajustadas manualmente; no corresponden a un escenario NASA certificado."}</p>
   <div className="mt-6 grid gap-5 sm:grid-cols-3">
    <label className="text-sm">{t("Oxígeno (%)","Oxygen (%)")}<span className="float-right font-bold text-amber-300">{fmt(o2,1)}%</span><input type="range" min={0} max={100} value={o2} onChange={e=>{setPreset("");setO2(Number(e.target.value))}} className="mt-4 block w-full accent-amber-300"/></label>
    <label className="text-sm">{t("Presión (psi)","Pressure (psi)")}<span className="float-right font-bold text-amber-300">{fmt(pressure,1)}</span><input type="range" min={0} max={30} step=".1" value={Math.min(30,pressure)} onChange={e=>{setPreset("");setPressure(Number(e.target.value))}} className="mt-4 block w-full accent-amber-300"/></label>
    <div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={flow!==null} onChange={e=>setFlow(e.target.checked?0:null)}/> Incluir flujo de aire</label>{flow!==null&&<label className="mt-3 block text-xs">Flujo: {fmt(flow)} cm/s<input type="range" min={0} max={50} value={flow} onChange={e=>setFlow(Number(e.target.value))} className="mt-2 block w-full accent-sky-300"/></label>}<p className="mt-2 text-xs text-slate-400">{t("No se sustituye un flujo no documentado por cero.","An undocumented airflow is never replaced by zero.")}</p></div>
   </div>
   <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-200/[.06] p-4 text-sm text-slate-300"><strong className="text-amber-200">{t("Advertencia:","Warning:")}</strong> un ambiente enriquecido con oxígeno requiere mayor atención a materiales e ignición. No existe aquí una escala de riesgo Bajo/Alto/Crítico científicamente calibrada; la forma del fuego depende también de la presión, combustible y ventilación.</div>
  </section>
  <section className="sices-glass p-5 sm:p-7"><div className="flex flex-wrap justify-between gap-2"><div><p className="sices-kicker">{t("RECOMENDACIONES CON TRAZABILIDAD","TRACEABLE RECOMMENDATIONS")}</p><h3 className="mt-2 text-2xl font-bold">{t("Ranking de investigaciones PSI","PSI study ranking")}</h3></div>{pending?<LoaderCircle size={18} className="animate-spin text-amber-300"/>:tag((answer?.comparedInvestigations||0)+" investigaciones examinadas")}</div>
   {error&&<p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
   <div className="mt-5 space-y-3">{answer?.matches.length?answer.matches.map((m,i)=><div key={m.investigationId} className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-sky-300">#{i+1}</span><strong>{m.label}</strong>{tag(m.status==="CONDITIONS"?"Condiciones comparables":m.status==="PARTIAL"?"Coincidencia parcial":"Solo relación temática",m.status==="CONDITIONS"?"green":"amber")}</div>
    <p className="mt-2 text-sm text-slate-300">{m.reason}</p>
    <p className="mt-2 break-all text-xs text-slate-500">Comparadas: {m.matchedDimensions.join(", ")||"ninguna"} · Faltan: {m.missingDimensions.join(", ")||"ninguna"} {m.distance!==null?"· Distancia normalizada "+fmt(m.distance,4):""}</p>
    {m.sourcePath.startsWith("NASA_PSI/")&&<a href={sourceHref(m.sourcePath)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-sky-300 underline">Abrir archivo PSI <ArrowUpRight size={13}/></a>}
   </div>):<p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">{t("No hay estudios con condiciones verificables para esta consulta.","No studies have verified conditions for this request.")}</p>}</div>
   <p className="mt-4 text-xs leading-relaxed text-slate-400">{answer?.disclaimer}</p>
  </section>
 </div>;
}

function StudyCompare({data}:{data:PsiData}){
 const {t,language}=useSicesPreferences();
 const [a,setA]=React.useState("");
 const [b,setB]=React.useState("");
 const [profiles,setProfiles]=React.useState<Profile[]>([]);
 const [warning,setWarning]=React.useState("");
 const [error,setError]=React.useState("");
 async function run(){
  if(!a||!b||a===b)return;setError("");setProfiles([]);
  try{const r=await fetch("/api/compare?"+new URLSearchParams({a,b}));const v=await r.json();if(!r.ok)throw Error(v.error||"Sin comparación");setProfiles(v.profiles);setWarning(v.warning)}
  catch(e){setError(e instanceof Error?e.message:"Error")}
 }
 const columns:[keyof Profile["metrics"],string][]=[["oxygenPercent","Oxígeno inicial (%)"],["pressurePsi","Presión (psi)"],["airflowCmS","Flujo (cm/s)"],["temperatureC","Temperatura (°C)"]];
 return <section className="sices-glass p-5 sm:p-7">
  <p className="sices-kicker">{t("DOS INVESTIGACIONES / SIN RELLENO FICTICIO","TWO INVESTIGATIONS • NO FABRICATED VALUES")}</p><h3 className="mt-2 text-3xl font-bold">{t("Cara a cara","Side by side")}</h3>
  <p className="mt-2 text-sm text-slate-400">{t("Selecciona dos estudios NASA PSI y comprueba qué magnitudes tienen documentadas. Los valores ausentes se muestran como N/D y no se mezclan combustibles diferentes como si fueran el mismo ensayo.","Select two NASA PSI studies and inspect their documented variables. Missing values appear as N/A. Different fuels are not treated as the same test.")}</p>
  <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">{[[t("Primer experimento","First study"),a,setA],[t("Segundo experimento","Second study"),b,setB]].map(([title,value,setter],idx)=><label className="text-xs text-slate-300" key={idx}>{title as string}<select className="sices-input mt-2" value={value as string} onChange={e=>(setter as (v:string)=>void)(e.target.value)}><option value="">{t("Selecciona","Select")}</option>{data.investigations.map(i=><option key={i.id} value={i.id}>{i.shortName}</option>)}</select></label>)}<button type="button" disabled={!a||!b||a===b} onClick={()=>void run()} className="sices-primary self-end disabled:opacity-40"><GitCompareArrows size={15}/> Comparar</button></div>
  {error&&<p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
  {profiles.length>0&&<div className="mt-6 space-y-4">
   <p className="text-xs text-slate-400">{warning}</p>
   <div className="grid gap-4 md:grid-cols-2">{profiles.map(p=><article key={p.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
    <p className="text-xs font-semibold text-sky-300">{p.psiCode}</p><h4 className="mt-2 text-xl font-bold">{p.shortName}</h4>
    <p className="mt-3 text-sm text-slate-300">{p.objectives||"No se documentaron objetivos para esta ficha."}</p>
    <div className="mt-4 space-y-1">{columns.map(([key,name])=><div key={key} className="flex justify-between gap-3 border-b border-white/10 py-2 text-xs"><span className="text-slate-300">{name}</span><strong className="text-right">{p.metrics[key]?fmt(p.metrics[key]!.min)+" – "+fmt(p.metrics[key]!.max):"N/D"}</strong></div>)}</div>
    <p className="mt-3 text-xs text-slate-400">Equipo: {p.hardware||"N/D"} · Gravedad: {p.gravityRegime||"N/D"} · Series: {p.series}</p>
    {p.sourcePaths.slice(0,2).map(path=><a key={path} className="mt-2 block break-all text-[11px] text-sky-300 underline" href={sourceHref(path)} target="_blank" rel="noopener noreferrer">{path}</a>)}
   </article>)}</div>
  </div>}
 </section>;
}

export function ScientificLaboratory({data,focus,onStudy}:{data:PsiData;focus:string;onStudy:(code:string)=>void}){
 const {t,language}=useSicesPreferences();
 const [view,setView]=React.useState<"curves"|"scenario"|"compare"|"sources">("curves");
 const [datasets,setDatasets]=React.useState<Dataset[]>([]);
 const [loading,setLoading]=React.useState(true);
 const [error,setError]=React.useState("");
 const [activePsi,setActivePsi]=React.useState("");
 React.useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/series",{signal:controller.signal,cache:"no-store"})
   .then(async r=>{const value=await r.json();if(!r.ok)throw Error(value.error||"No se pudieron cargar series");return value as Dataset[]})
   .then(v=>setDatasets(v)).catch(e=>{if(!controller.signal.aborted)setError(String(e))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[]);
 React.useEffect(()=>{if(focus){setActivePsi(focus);setView("curves")}},[focus]);
 const curves=React.useMemo(()=>datasets.flatMap(dataset=>dataset.series.map(series=>({dataset,series}))),[datasets]);
 const selected=data.investigations.find(i=>i.psiCode===activePsi);
 const menu:[typeof view,string,React.ReactNode][]=[
  ["curves",t("Curvas y fuentes","Curves & sources"),<ChartNoAxesCombined size={16} key="a"/>],
  ["scenario",t("Condiciones","Conditions"),<SlidersHorizontal size={16} key="b"/>],
  ["compare",t("Comparador","Compare"),<GitCompareArrows size={16} key="c"/>],
  ["sources",t("Biblioteca PSI","PSI library"),<BookOpen size={16} key="d"/>]
 ];
 return <div className="space-y-6">
  <div className="flex flex-wrap items-center justify-between gap-4">
   <div><span className="sices-pill">{t("MODO INGENIERÍA • NASA PSI","ENGINEERING MODE • NASA PSI")}</span><h2 className="mt-3 text-3xl font-bold sm:text-4xl">{t("Laboratorio de datos reales","Real-data laboratory")}</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{t("Explora series experimentales originales, compara solo variables compatibles y conoce la procedencia de cada punto.","Explore original experimental curves, compare compatible variables and trace every measurement back to its source.")}</p></div>
   <AiAssistantPanel investigationId={selected?.id??null} metric={null} seriesIds={curves.filter(c=>c.dataset.investigationId===selected?.id).slice(0,8).map(c=>c.series.id)} psiCode={selected?.psiCode}/>
  </div>
  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones de laboratorio">{menu.map(([id,text,icon])=><button role="tab" aria-selected={view===id} type="button" key={id} className={"sices-mode-tab "+(view===id?"sices-mode-tab-active":"")} onClick={()=>setView(id)}>{icon}{text}</button>)}</div>
  {error&&<p role="alert" className="rounded-xl border border-rose-300/30 p-4 text-sm text-rose-200">{error}</p>}
  {view==="curves"&&(loading?<div className="sices-glass flex min-h-52 items-center justify-center gap-3 p-8 text-slate-300"><LoaderCircle className="animate-spin"/> Consultando series NASA PSI…</div>:<DataExplorer catalog={data.investigations} curves={curves} onFocus={onStudy} focus={activePsi}/>)}
  {view==="scenario"&&<ScenarioLab data={data}/>}
  {view==="compare"&&<StudyCompare data={data}/>}
  {view==="sources"&&<div className="space-y-5">
   <section className="sices-glass p-6"><p className="sices-kicker">{t("BIBLIOTECA DE ORIGEN","SOURCE LIBRARY")}</p><h3 className="mt-2 text-2xl font-bold">{t("¿De dónde viene cada número?","Where does each number come from?")}</h3><p className="mt-2 text-sm text-slate-300">{t("Archivos NASA PSI vinculados a las tablas y curvas, con separación entre registros disponibles y variables faltantes. Nunca usamos datos sintéticos para completar una figura.","NASA PSI source files linked to curves and tables. We distinguish available measurements from missing values and never fill gaps with fabricated points.")}</p>
   <div className="mt-4 grid gap-3 sm:grid-cols-3">{[[data.investigations.length,t("investigaciones PSI","PSI studies")],[curves.length,t("series experimentales trazables","traceable experimental curves")],[data.counts.totalRows,t("filas normalizadas","normalized observations")]].map(([n,text])=><div className="rounded-xl border border-white/10 bg-white/[.04] p-4" key={text}><strong className="text-2xl text-sky-200">{Number(n).toLocaleString("es-DO")}</strong><p className="mt-1 text-xs text-slate-400">{text}</p></div>)}</div>
   </section>
   <div className="grid gap-3 md:grid-cols-2">{data.investigations.map(i=>{
     const science=curves.filter(c=>c.dataset.investigationId===i.id);const paths=[...new Set(science.map(c=>c.dataset.provenance.sourcePath))];
     return <article key={i.id} className="sices-glass p-5"><p className="text-xs font-bold text-sky-300">{i.psiCode}</p><h4 className="mt-1 font-bold">{i.shortName}</h4><p className="mt-2 text-sm text-slate-400">{i.laymanSummary}</p><p className="mt-3 text-xs text-slate-300">{science.length} {t("series experimentales con origen","source-backed experimental curves")} · {i._count.normalizedObservations} {t("filas normalizadas","normalized observations")}</p>
      {i.psiUrl&&<a href={i.psiUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-xs text-amber-300 underline">Página NASA PSI <ArrowUpRight size={12}/></a>}
      {paths.slice(0,2).map(path=><a key={path} href={sourceHref(path)} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-[11px] text-sky-300 underline">{path}</a>)}
     </article>;
   })}</div>
  </div>}
 </div>;
}
