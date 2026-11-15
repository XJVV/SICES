"use client";
import * as React from "react";
import { ArrowUpRight, Database, Download, FileSpreadsheet, Info, LoaderCircle } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSicesPreferences } from "./user-preferences";

type FileInfo={name:string;path:string;size:number;kind:string;previewable:boolean};
type Manifest={code:string;files:FileInfo[];totalFiles:number;csvTables:number;readableCSV:number;hasFiles:boolean};
type Preview={code:string;file:FileInfo;columns:string[];rows:string[][];totalRows:number;isPreview:boolean;description:string};
type Props={code:string};
function scientificNumber(value:string):number|null{
 const x=value.trim();
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(x))return null;
 const n=Number(x);return Number.isFinite(n)?n:null;
}
function origin(path:string){
 return "https://github.com/XJVV/SICES/blob/feature/sices-nasa-evolution/cvs/NASA_PSI/"+
   path.split("/").map(encodeURIComponent).join("/");
}
export function RawPSIExplorer({code}:Props){
 const {t}=useSicesPreferences();
 const [manifest,setManifest]=React.useState<Manifest|null>(null);
 const [index,setIndex]=React.useState<number|null>(null);
 const [preview,setPreview]=React.useState<Preview|null>(null);
 const [metric,setMetric]=React.useState<number|null>(null);
 const [pending,setPending]=React.useState(false);
 const [error,setError]=React.useState("");
 React.useEffect(()=>{
  if(!code){setManifest(null);return}
  const ctrl=new AbortController();setPending(true);setError("");setManifest(null);setPreview(null);setIndex(null);
  fetch("/api/psi-raw?"+new URLSearchParams({code}),{signal:ctrl.signal})
   .then(async res=>{const x=await res.json();if(!res.ok)throw Error(x.error||"Error");return x as Manifest})
   .then(data=>{setManifest(data);const first=data.files.findIndex(f=>f.previewable&&f.kind==="EXPERIMENTAL_TABLE");const fallback=data.files.findIndex(f=>f.previewable);setIndex(first>=0?first:fallback>=0?fallback:null)})
   .catch(e=>{if(!ctrl.signal.aborted)setError(String(e))})
   .finally(()=>{if(!ctrl.signal.aborted)setPending(false)});
  return()=>ctrl.abort();
 },[code]);
 React.useEffect(()=>{
  if(index===null||!manifest)return;
  const ctrl=new AbortController();setPending(true);setPreview(null);setMetric(null);setError("");
  fetch("/api/psi-raw?"+new URLSearchParams({code,file:String(index)}),{signal:ctrl.signal})
   .then(async res=>{const x=await res.json();if(!res.ok)throw Error(x.error||"Error");return x as Preview})
   .then(setPreview)
   .catch(e=>{if(!ctrl.signal.aborted)setError(String(e))})
   .finally(()=>{if(!ctrl.signal.aborted)setPending(false)});
  return()=>ctrl.abort();
 },[code,index,manifest]);
 const numeric=React.useMemo(()=>{
   if(!preview)return [];
   return preview.columns.map((name,i)=>({i,name,count:preview.rows.filter(row=>scientificNumber(row[i]||"")!==null).length}))
    .filter(v=>v.count>=3);
 },[preview]);
 const active=metric===null?numeric[0]?.i??null:metric;
 const chart=React.useMemo(()=>{
  if(!preview||active===null)return [];
  return preview.rows.map((row,i)=>({sample:i+1,value:scientificNumber(row[active]||"")})).filter(x=>x.value!==null);
 },[preview,active]);
 if(!code)return null;
 return <section className="mt-6 rounded-2xl border border-sky-300/25 bg-sky-400/[.045] p-4 sm:p-6" aria-label={t("Datos originales de NASA PSI","Original NASA PSI data")}>
  <div className="flex flex-wrap justify-between gap-3">
   <div><p className="sices-kicker">{t("ARCHIVOS ORIGINALES • NASA PSI","SOURCE FILES • NASA PSI")}</p>
    <h3 className="mt-2 flex items-center gap-2 text-xl font-bold"><FileSpreadsheet className="text-sky-300"/>{t("Tablas reales del experimento","Actual experiment tables")} {code}</h3>
    <p className="mt-2 max-w-2xl text-sm text-slate-300">{t("Una tabla de muestras o ensayos también es ciencia real, aunque no tenga curvas tiempo–temperatura. Leemos el CSV original, sin inventar puntos ni unidades.","Samples and test-run tables are real scientific data even when no time-series chart exists. We read the original CSV without making up points or units.")}</p>
   </div>
   {manifest&&<div className="flex gap-2 self-start"><span className="rounded-lg bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-200">{manifest.csvTables} {t("tablas de ensayos CSV","CSV test tables")}</span><span className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">{manifest.totalFiles} {t("archivos","files")}</span></div>}
  </div>
  {pending&&<p role="status" className="mt-4 flex items-center gap-2 text-sm text-sky-200"><LoaderCircle size={15} className="animate-spin"/>{t("Leyendo archivos originales…","Reading source files…")}</p>}
  {error&&<p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
  {manifest&&<div className="mt-5 space-y-4">
   <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
    <label className="block text-xs font-semibold text-slate-300">{t("Selecciona un archivo CSV original","Select an original CSV file")}
     <select className="sices-input mt-2" aria-label={t("Archivo original","Source file")} value={index??""} onChange={e=>setIndex(e.target.value===""?null:Number(e.target.value))}>
      {manifest.files.filter(f=>f.previewable).length===0?<option value="">{t("Sin CSV visualizable","No previewable CSV")}</option>:manifest.files.map((f,i)=>f.previewable?<option key={i} value={i}>{f.name} · {f.kind.replaceAll("_"," ")}</option>:null)}
     </select>
    </label>
    {index!==null&&<a className="sices-secondary self-end" href={origin(manifest.files[index].path)} target="_blank" rel="noopener noreferrer"><Download size={15}/>{t("Abrir CSV fuente","Open source CSV")}</a>}
   </div>
   {preview&&<div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300"><Database size={15}/>{preview.totalRows.toLocaleString()} {t("registros de origen","source rows")}{preview.isPreview&&<> · {t("vista previa de las primeras","first")} {preview.rows.length} {t("filas","rows")}</>}</div>
    <div className="max-h-[390px] overflow-auto rounded-xl border border-white/10" tabIndex={0} role="region" aria-label={t("Tabla de observaciones originales desplazable","Scrollable original observations table")}>
     <table className="w-max min-w-full text-left text-xs">
      <thead className="sticky top-0 z-10 bg-[#16334c] text-sky-100"><tr><th className="whitespace-nowrap px-3 py-3">#</th>{preview.columns.map((name,i)=><th className="min-w-36 whitespace-normal border-l border-white/10 px-3 py-3" key={i}>{name}</th>)}</tr></thead>
      <tbody>{preview.rows.map((row,i)=><tr key={i} className="border-t border-white/10 even:bg-white/[.04]"><th scope="row" className="px-3 py-2 font-mono text-sky-300">{i+1}</th>{row.map((v,j)=><td className="max-w-72 whitespace-normal break-words border-l border-white/10 px-3 py-2" key={j}>{v||"—"}</td>)}</tr>)}</tbody>
     </table>
    </div>
    {numeric.length>0&&<div className="rounded-xl border border-white/10 bg-slate-950/25 p-4">
     <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">{t("Explorar una columna numérica real","Explore a real numeric column")}</h4><span className="text-xs text-slate-400">{t("Eje X = número de fila (no tiempo)","X axis = row number (not time)")}</span></div>
     <label className="mt-3 block text-xs text-slate-300">{t("Magnitud del CSV original","Original CSV variable")}
      <select className="sices-input mt-2" value={active??""} onChange={e=>setMetric(Number(e.target.value))}>{numeric.map(v=><option key={v.i} value={v.i}>{v.name} ({v.count} {t("valores","values")})</option>)}</select>
     </label>
     <div className="mt-4 h-64 w-full"><ResponsiveContainer width="100%" height="100%">
      <LineChart data={chart} margin={{top:10,right:16,left:0,bottom:10}}>
       <CartesianGrid stroke="rgba(148,163,184,.12)" strokeDasharray="4 4"/>
       <XAxis type="number" dataKey="sample" domain={["dataMin","dataMax"]} tick={{fill:"#bed5e2",fontSize:11}} stroke="#64748b"/>
       <YAxis type="number" tick={{fill:"#bed5e2",fontSize:11}} stroke="#64748b" width={55}/>
       <Tooltip labelFormatter={v=>t("Fila","Row")+" "+v} contentStyle={{background:"#102b42",borderColor:"#64748b",color:"#fff"}}/>
       <Line dataKey="value" type="linear" stroke="#7dd3fc" strokeWidth={2} dot={chart.length<40} isAnimationActive={false} name={preview.columns[active??0]}/>
      </LineChart>
     </ResponsiveContainer></div>
     <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-200"><Info size={15} className="shrink-0"/>{t("Cada punto es una fila original; unir los puntos sirve para explorar, pero no implica continuidad física ni que la variable cambie con el tiempo.","Each point represents an original source row. Connecting them is only for exploration, not proof of physical continuity or time evolution.")}</p>
    </div>}
   </div>}
   {manifest.files.length>0&&<details className="rounded-xl border border-white/10 p-3 text-sm text-slate-300"><summary className="cursor-pointer font-semibold">{t("Ver todos los archivos de investigación","All investigation files")} ({manifest.files.length})</summary><div className="mt-3 max-h-72 space-y-2 overflow-auto">{manifest.files.map((f,i)=><a className="block break-all text-xs text-sky-300 underline" href={origin(f.path)} target="_blank" rel="noopener noreferrer" key={i}><ArrowUpRight size={12} className="mr-1 inline"/>{f.path} <span className="text-slate-400">({Math.round(f.size/1024)} KB)</span></a>)}</div></details>}
   {manifest.files.length===0&&<p className="mt-3 text-sm text-slate-300">{t("No se encontraron archivos en esta instalación. No se mostrarán datos ficticios.","No source files were found in this installation. No fictional data will be displayed.")}</p>}
  </div>}
 </section>;
}
