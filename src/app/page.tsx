"use client";

import * as React from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Database, Flame, GraduationCap, Lightbulb, LoaderCircle, Microscope, Orbit, Rocket, ShieldCheck, Sparkles, Telescope, Zap } from "lucide-react";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider, AuthHeaderButton } from "@/components/system/auth";
import { Toaster } from "@/components/ui/toaster";
import { FlamePlayground } from "@/components/sices/flame-playground";
import { ScientificLaboratory, type PsiData } from "@/components/sices/scientific-lab";

type Experience = "educational" | "scientific";
type SafetyTheme = "prevention" | "detection" | "suppression";
const cases:{
 id:SafetyTheme;number:string;icon:string;title:string;prompt:string;earth:string;space:string;application:string;psi:string;code:string;source:string
}[]=[
 {id:"prevention",number:"01",icon:"🛡️",title:"Prevenir",prompt:"¿Y si una prenda empieza a arder?",
  earth:"El aire caliente sube y puede influir en la propagación del fuego sobre una superficie.",
  space:"El movimiento del aire por ventilación puede dominar el avance de una llama por material sólido.",
  application:"Conocer qué materiales propagan el fuego ayuda a estudiar su selección en naves y hábitats; no certifica un traje de bombero.",
  psi:"BASS",code:"PSI-26",source:"https://www.nasa.gov/missions/station/studying-combustion-and-fire-safety/"},
 {id:"detection",number:"02",icon:"🔔",title:"Detectar",prompt:"¿Cómo encontrar el humo si no sube?",
  earth:"El humo caliente suele elevarse por flotabilidad: muchos detectores se instalan cerca del techo.",
  space:"Sin flotabilidad apreciable, las corrientes de ventilación ayudan a transportar partículas hacia los sensores.",
  application:"El estudio del humo ayuda a analizar nuevas estrategias de detección; no prueba que SAME inventara un detector terrestre específico.",
  psi:"SAME",code:"PSI-102",source:"https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-008-fire-protection.pdf"},
 {id:"suppression",number:"03",icon:"🧯",title:"Extinguir",prompt:"¿Se apaga igual una llama en órbita?",
  earth:"La convección y la geometría de la llama influyen en cómo el combustible y el oxígeno se encuentran.",
  space:"La difusión y la ventilación modifican el suministro de oxígeno; FLEX estudia fenómenos de extinción de gotas.",
  application:"Comprender los límites de extinción orienta la investigación sobre protección contra incendios en el espacio.",
  psi:"FLEX",code:"PSI-69",source:"https://www.nasa.gov/missions/station/studying-combustion-and-fire-safety/"}
];

function ExperiencePage(){
 const [mode,setMode]=React.useState<Experience>("educational");
 const [data,setData]=React.useState<PsiData|null>(null);
 const [busy,setBusy]=React.useState(true);
 const [error,setError]=React.useState("");
 const [focus,setFocus]=React.useState("");
 const [caseId,setCaseId]=React.useState<SafetyTheme>("prevention");
 const [world,setWorld]=React.useState<"earth"|"space">("space");
 const selected=cases.find(c=>c.id===caseId)!;
 React.useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/observatory",{cache:"no-store",signal:controller.signal})
    .then(async res=>{const json=await res.json();if(!res.ok)throw Error(json.error||"No se puede leer NASA PSI");return json as PsiData})
    .then(setData).catch(e=>{if(!controller.signal.aborted)setError(String(e))})
    .finally(()=>{if(!controller.signal.aborted)setBusy(false)});
  return()=>controller.abort();
 },[]);
 const toLab=(code:string)=>{
  setFocus(code);
  setMode("scientific");
  window.scrollTo({top:0,behavior:"smooth"});
 };
 const setModeAndTop=(m:Experience)=>{
  setMode(m);
  window.scrollTo({top:0,behavior:"smooth"});
 };
 return <div className="sices-v4 min-h-screen text-slate-100">
  <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden"><div className="sices-sky-orb sices-sky-orb-a"/><div className="sices-sky-orb sices-sky-orb-b"/></div>
  <div className="relative mx-auto max-w-[1440px] px-4 sm:px-7 lg:px-10">
   <header className="sices-header flex flex-wrap items-center justify-between gap-4 py-5">
    <button type="button" className="flex items-center gap-3 text-left" onClick={()=>setModeAndTop("educational")} aria-label="SICES: ir a explorar">
     <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/40 bg-amber-300/10 text-amber-300"><Flame size={26}/></span>
     <span><span className="block text-2xl font-black tracking-[-.07em]">SICES<span className="text-amber-300">.</span></span><span className="block text-[9px] font-bold tracking-[.23em] text-sky-200/70">SPACE FIRE DISCOVERY</span></span>
    </button>
    <div className="order-3 flex w-full justify-center gap-1 rounded-2xl border border-white/10 bg-slate-950/50 p-1.5 sm:order-2 sm:w-auto" role="tablist" aria-label="Tipo de experiencia">
     <button type="button" role="tab" aria-selected={mode==="educational"} className={"sices-main-tab "+(mode==="educational"?"sices-main-tab-active":"")} onClick={()=>setModeAndTop("educational")}><GraduationCap size={17}/> Aprender jugando</button>
     <button type="button" role="tab" aria-selected={mode==="scientific"} className={"sices-main-tab "+(mode==="scientific"?"sices-main-tab-active":"")} onClick={()=>setModeAndTop("scientific")}><Microscope size={17}/> Laboratorio científico</button>
    </div>
    <div className="order-2 flex items-center gap-3 sm:order-3"><span className="hidden rounded-full border border-sky-300/20 px-3 py-1.5 text-[10px] font-bold tracking-widest text-sky-200 md:inline-flex">NASA PSI ONLY</span><AuthHeaderButton/></div>
   </header>
   <main className="pb-16">
    {mode==="educational"?<>
     <section className="relative overflow-hidden py-12 sm:py-20">
      <div className="absolute -right-14 top-3 hidden h-60 w-60 rounded-full border border-sky-300/10 lg:block"><div className="absolute inset-10 rounded-full border border-sky-300/10"/><div className="absolute inset-20 rounded-full border border-amber-300/10"/></div>
      <div className="relative max-w-4xl">
       <span className="sices-pill"><Sparkles size={13}/> MISIÓN ESPACIAL 2026 · NASA PSI</span>
       <h1 className="mt-7 text-5xl font-black leading-[1.02] tracking-[-.065em] sm:text-7xl lg:text-[88px]">El fuego no se<br/>comporta igual <span className="sices-gradient-text">en el espacio.</span></h1>
       <p className="mt-7 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">Descubre qué pasa cuando la gravedad casi desaparece. Cambia el ambiente de una llama, resuelve misiones y conoce investigaciones reales que ayudan a proteger astronautas.</p>
       <div className="mt-8 flex flex-wrap items-center gap-3">
        <a href="#simulador" className="sices-primary"><Flame size={18}/> ¡Probar las llamas! <ArrowRight size={17}/></a>
        <button type="button" onClick={()=>setModeAndTop("scientific")} className="sices-secondary"><Database size={17}/> Ver datos científicos</button>
       </div>
       <div className="mt-10 flex flex-wrap gap-5 border-t border-white/10 pt-5 text-xs text-slate-400"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-300"/> Ciencia respaldada por fuentes</span><span className="flex items-center gap-2"><Sparkles size={16} className="text-amber-300"/> Experiencia interactiva</span><span className="flex items-center gap-2"><BookOpen size={16} className="text-sky-300"/> Sin fórmulas complicadas</span></div>
      </div>
     </section>
     <section id="simulador" className="scroll-mt-24"><FlamePlayground onStudy={toLab}/></section>
     <section className="mt-24 space-y-7">
      <div className="max-w-2xl"><span className="sices-pill">04 / DEL ESPACIO A LA TIERRA</span><h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">La investigación espacial también <span className="text-sky-300">nos enseña a estar más seguros.</span></h2><p className="mt-4 text-slate-300">Selecciona un reto real: prevenir incendios, detectar humo o aprender a extinguir llamas. Cambia de mundo y observa por qué la gravedad importa.</p></div>
      <div className="grid gap-6 lg:grid-cols-[.37fr_.63fr]">
       <div className="space-y-3">{cases.map(c=><button type="button" key={c.id} onClick={()=>setCaseId(c.id)} className={"group flex w-full items-center gap-4 rounded-2xl border px-5 py-5 text-left transition-all "+(caseId===c.id?"border-amber-300/50 bg-amber-300/10":"border-white/10 bg-white/[.035] hover:bg-white/[.07]")}><span className="text-3xl">{c.icon}</span><span className="flex-1"><span className="block text-[11px] font-bold tracking-widest text-slate-400">CASO {c.number}</span><strong className="text-lg">{c.title}</strong><span className="mt-1 block text-xs text-slate-400">{c.prompt}</span></span><ArrowRight size={16} className="text-slate-400 group-hover:text-amber-300"/></button>)}</div>
       <div className="sices-glass p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="sices-pill">CASO {selected.number} • {selected.title.toUpperCase()}</span><div className="flex gap-1 rounded-xl bg-white/[.04] p-1"><button type="button" className={"sices-small-tab "+(world==="earth"?"sices-small-tab-active":"")} onClick={()=>setWorld("earth")}>🌍 Tierra</button><button type="button" className={"sices-small-tab "+(world==="space"?"sices-small-tab-active":"")} onClick={()=>setWorld("space")}>🛰️ Espacio</button></div></div>
        <h3 className="mt-6 text-2xl font-bold">{selected.prompt}</h3>
        <div className="mt-4 min-h-[126px] rounded-2xl border border-sky-300/15 bg-sky-300/[.06] p-5"><p className="text-xs font-bold uppercase tracking-widest text-sky-200">{world==="earth"?"En la Tierra":"En microgravedad"}</p><p className="mt-2 text-base leading-relaxed text-slate-100">{world==="earth"?selected.earth:selected.space}</p></div>
        <div className="mt-5 rounded-xl border border-white/10 p-4"><p className="text-xs font-bold text-amber-200">¿Y aquí en la Tierra?</p><p className="mt-2 text-sm leading-relaxed text-slate-300">{selected.application}</p></div>
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={()=>toLab(selected.code)} className="sices-primary">Explorar {selected.psi} en NASA PSI <ArrowUpRight size={16}/></button><a className="sices-secondary" href={selected.source} target="_blank" rel="noopener noreferrer">Fuente NASA <ArrowUpRight size={15}/></a></div>
       </div>
      </div>
     </section>
     <section className="mt-20 rounded-[32px] border border-sky-300/20 bg-gradient-to-r from-[#092945] to-[#0d1b2f] p-7 sm:p-10">
       <div className="flex flex-wrap items-center justify-between gap-7"><div className="max-w-2xl"><span className="sices-kicker">SIGUIENTE NIVEL</span><h2 className="mt-2 text-3xl font-bold">¿Listo para descubrir los números reales?</h2><p className="mt-3 text-sm leading-relaxed text-slate-300">El laboratorio científico no dibuja puntos imaginarios: muestra series de archivos NASA PSI identificables, con unidades, procedencia y exportación de datos.</p></div><button className="sices-primary" onClick={()=>setModeAndTop("scientific")}>Entrar al laboratorio <ArrowRight size={17}/></button></div>
     </section>
    </>:busy?<div className="sices-glass my-24 flex min-h-72 items-center justify-center gap-3 text-slate-300"><LoaderCircle size={24} className="animate-spin text-sky-300"/> Preparando NASA PSI…</div>:error?<div role="alert" className="sices-glass my-20 p-8"><h2 className="text-xl font-bold">No se pudo abrir la base científica</h2><p className="mt-2 text-sm text-rose-200">{error}</p><p className="mt-3 text-sm text-slate-400">Comprueba db/custom.db y el esquema Prisma. No presentaremos datos de ejemplo para ocultar el error.</p></div>:data?<ScientificLaboratory data={data} focus={focus} onStudy={setFocus}/>:null}
   </main>
   <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-7 text-xs text-slate-400">
    <div className="flex items-center gap-2"><Flame size={17} className="text-amber-300"/><strong className="text-slate-200">SICES</strong><span>· NASA Physical Sciences Informatics</span></div>
    <div>Aprender con ilustraciones · Analizar con datos PSI reales · 2026</div>
    <a href="https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:underline">Desafío NASA Space Apps <ArrowUpRight size={13}/></a>
   </footer>
  </div>
 </div>;
}
export default function Home(){
 return <LanguageProvider><AuthProvider><ExperiencePage/><Toaster/></AuthProvider></LanguageProvider>;
}
