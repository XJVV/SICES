"use client";

import * as React from "react";
import { Accessibility, Contrast, Minus, Plus, RotateCcw, Languages, PauseCircle } from "lucide-react";

export type SicesLanguage="es"|"en";
type Preferences={
  language:SicesLanguage;
  setLanguage:(next:SicesLanguage)=>void;
  scale:number;
  setScale:(next:number)=>void;
  highContrast:boolean;
  setHighContrast:(next:boolean)=>void;
  reducedMotion:boolean;
  setReducedMotion:(next:boolean)=>void;
  t:(es:string,en:string)=>string;
};
const defaults:Preferences={
 language:"es",setLanguage:()=>{},scale:1,setScale:()=>{},
 highContrast:false,setHighContrast:()=>{},
 reducedMotion:false,setReducedMotion:()=>{},
 t:(es)=>es
};
const Ctx=React.createContext<Preferences>(defaults);
const STORAGE="sices-display-settings-v1";
function clamp(n:number){return Math.max(.9,Math.min(1.6,Math.round(n*10)/10))}
export function SicesPreferencesProvider({children}:{children:React.ReactNode}){
 const [language,setLanguage]=React.useState<SicesLanguage>("es");
 const [scale,scaleState]=React.useState(1);
 const [highContrast,setHighContrast]=React.useState(false);
 const [reducedMotion,setReducedMotion]=React.useState(false);
 const [ready,setReady]=React.useState(false);
 React.useEffect(()=>{
  try{
   const saved=JSON.parse(localStorage.getItem(STORAGE)||"null");
   if(saved?.language==="es"||saved?.language==="en")setLanguage(saved.language);
   if(typeof saved?.scale==="number"&&Number.isFinite(saved.scale))scaleState(clamp(saved.scale));
   if(typeof saved?.highContrast==="boolean")setHighContrast(saved.highContrast);
   if(typeof saved?.reducedMotion==="boolean")setReducedMotion(saved.reducedMotion);
  }catch{/* Private browsing/storage unavailable */}
  setReady(true);
 },[]);
 React.useEffect(()=>{
  if(!ready)return;
  try{localStorage.setItem(STORAGE,JSON.stringify({language,scale,highContrast,reducedMotion}))}catch{}
 },[ready,language,scale,highContrast,reducedMotion]);
 const t=React.useCallback((es:string,en:string)=>language==="es"?es:en,[language]);
 const value=React.useMemo(()=>({language,setLanguage,scale,setScale:(n:number)=>scaleState(clamp(n)),highContrast,setHighContrast,reducedMotion,setReducedMotion,t}),[language,scale,highContrast,reducedMotion,t]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useSicesPreferences(){return React.useContext(Ctx)}
export function AccessibilityToolbar(){
 const {language,setLanguage,scale,setScale,highContrast,setHighContrast,reducedMotion,setReducedMotion,t}=useSicesPreferences();
 const [expanded,setExpanded]=React.useState(false);
 const restore=()=>{setScale(1);setHighContrast(false);setReducedMotion(false)};
 return <div className="relative flex items-center gap-1.5">
   <label className="flex items-center gap-1.5 rounded-lg border border-sky-200/20 bg-white/5 px-2 py-1 text-xs text-slate-100">
    <Languages size={15} aria-hidden="true"/>
    <span className="sr-only">{t("Idioma del programa","Program language")}</span>
    <select aria-label={t("Idioma del programa","Program language")} value={language} onChange={e=>setLanguage(e.target.value as SicesLanguage)} className="max-w-28 bg-transparent px-1 py-1.5 text-xs font-semibold text-white">
     <option value="es">Español</option><option value="en">English</option>
    </select>
   </label>
   <button type="button" className="sices-ctl" aria-expanded={expanded} aria-controls="sices-access-panel" onClick={()=>setExpanded(v=>!v)}>
    <Accessibility size={16} aria-hidden="true"/>
    <span>{t("Accesibilidad","Accessibility")}</span>
   </button>
   {expanded&&<section id="sices-access-panel" aria-label={t("Opciones de accesibilidad","Accessibility options")} className="absolute right-0 top-[calc(100%+12px)] z-[60] w-[min(310px,90vw)] space-y-4 rounded-2xl border border-sky-200/35 bg-[#0b2033] p-5 text-white shadow-2xl">
    <div className="flex items-center justify-between"><h2 className="font-bold">{t("Accesibilidad","Accessibility")}</h2><span className="text-xs text-slate-300">{Math.round(scale*100)}%</span></div>
    <div><p className="text-xs font-semibold">{t("Tamaño del contenido y texto","Text and content size")}</p>
     <div className="mt-2 flex gap-2">
      <button type="button" className="sices-ctl flex-1" aria-label={t("Reducir tamaño del texto","Decrease text size")} disabled={scale<=.9} onClick={()=>setScale(scale-.1)}><Minus size={16}/><span>{t("Reducir","Smaller")}</span></button>
      <button type="button" className="sices-ctl flex-1" aria-label={t("Aumentar tamaño del texto","Increase text size")} disabled={scale>=1.6} onClick={()=>setScale(scale+.1)}><Plus size={16}/><span>{t("Ampliar","Larger")}</span></button>
     </div>
    </div>
    <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={highContrast} onChange={e=>setHighContrast(e.target.checked)}/><Contrast size={15}/>{t("Alto contraste","High contrast")}</label>
    <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={reducedMotion} onChange={e=>setReducedMotion(e.target.checked)}/><PauseCircle size={15}/>{t("Reducir movimiento","Reduce motion")}</label>
    <p className="text-xs text-slate-300">{t("Los cambios se guardan en este navegador. Puedes usar Tab y Enter con los controles.","Changes are saved in this browser. You can also use Tab and Enter.")}</p>
    <button type="button" className="sices-ctl w-full" onClick={restore}><RotateCcw size={15}/>{t("Restablecer visualización","Reset display")}</button>
   </section>}
 </div>;
}
