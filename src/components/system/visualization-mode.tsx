"use client";
import * as React from "react";
type Mode = "educational" | "scientific";
const Context = React.createContext<{mode:Mode;setMode:(mode:Mode)=>void}>({mode:"educational",setMode:()=>{}});
export function VisualizationModeProvider({children}:{children:React.ReactNode}) {
  const [mode,setMode]=React.useState<Mode>("educational");
  return <Context.Provider value={{mode,setMode}}>{children}</Context.Provider>;
}
export function useVisualizationMode(){return React.useContext(Context);}
export function VisualizationModeToggle(){
  const {mode,setMode}=useVisualizationMode();
  return <label className="flex items-center gap-2 text-xs text-muted-foreground">
    <span className="hidden md:inline">Modo</span>
    <select aria-label="Modo de visualización" value={mode} onChange={e=>setMode(e.target.value as Mode)} className="rounded border bg-background px-2 py-2">
      <option value="educational">🎒 Niños y jóvenes</option>
      <option value="scientific">🔬 Ingeniería / Científico</option>
    </select>
  </label>;
}
