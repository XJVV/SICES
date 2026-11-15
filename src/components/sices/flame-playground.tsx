"use client";
"use client";

import * as React from "react";
import { ArrowLeftRight, ArrowUpRight, BookOpen, Flame, Lightbulb, Pause, Play, RotateCcw, ShieldCheck, Sparkles, Wind } from "lucide-react";
import { useSicesPreferences } from "./user-preferences";

export type GravityWorld = "earth" | "space";
type FlameCanvasProps = {
  world: GravityWorld;
  oxygen: number;
  ventilation: number;
  extinguished: boolean;
  paused: boolean;
  showMechanics: boolean;
};

function FlameCanvas({world,oxygen,ventilation,extinguished,paused,showMechanics}:FlameCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement|null>(null);
  const params = React.useRef({world,oxygen,ventilation,extinguished,paused,showMechanics});
  React.useEffect(()=>{params.current={world,oxygen,ventilation,extinguished,paused,showMechanics}},[world,oxygen,ventilation,extinguished,paused,showMechanics]);
  React.useEffect(()=>{
    const el=canvasRef.current;if(!el)return;
    const ctx=el.getContext("2d");if(!ctx)return;
    let frame=0,t=0,last=0,alive=true;
    let w=0,h=0,dpr=1;
    const stars=Array.from({length:70},(_,i)=>({x:(Math.sin(i*77.7)*541.3)%1,y:(Math.cos(i*23.1)*97.7)%1,r:0.3+(i%3)*0.35}));
    function resize(){
      const rect=el!.getBoundingClientRect();
      w=Math.max(120,rect.width);h=Math.max(150,rect.height);
      dpr=Math.min(2,window.devicePixelRatio||1);
      el!.width=Math.round(w*dpr);el!.height=Math.round(h*dpr);
      ctx!.setTransform(dpr,0,0,dpr,0,0);
    }
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    function glow(x:number,y:number,r:number,red:number,green:number,blue:number,alpha:number) {
      const g=ctx!.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,"rgba("+red+","+green+","+blue+","+alpha+")");
      g.addColorStop(1,"rgba("+red+","+green+","+blue+",0)");
      ctx!.fillStyle=g;ctx!.fillRect(x-r,y-r,r*2,r*2);
    }
    function tick(time:number){
      if(!alive)return;
      const p=params.current;
      if(!p.paused)t+=(last?Math.min(35,time-last):16)/1000;
      last=time;frame++;
      ctx!.clearRect(0,0,w,h);
      const bg=ctx!.createLinearGradient(0,0,w,h);
      bg.addColorStop(0,p.world==="earth"?"#101e2a":"#050d20");
      bg.addColorStop(1,p.world==="earth"?"#193347":"#07132b");
      ctx!.fillStyle=bg;ctx!.fillRect(0,0,w,h);
      // Subtle navigation grid (not a data chart).
      ctx!.strokeStyle=p.world==="space"?"rgba(99,171,240,.08)":"rgba(140,220,230,.06)";
      ctx!.lineWidth=1;
      for(let x=0;x<w;x+=34){ctx!.beginPath();ctx!.moveTo(x,0);ctx!.lineTo(x,h);ctx!.stroke()}
      for(let y=0;y<h;y+=34){ctx!.beginPath();ctx!.moveTo(0,y);ctx!.lineTo(w,y);ctx!.stroke()}
      if(p.world==="space"){
        for(const star of stars){
          const xx=(star.x+1)%1*w, yy=(star.y+1)%1*h;
          ctx!.fillStyle="rgba(196,231,255,"+(.13+.16*(Math.sin(t*.9+xx)+1)/2)+")";
          ctx!.beginPath();ctx!.arc(xx,yy,star.r,0,Math.PI*2);ctx!.fill();
        }
      }
      const cx=w*.5, cy=h*.57;
      const base=h*.77;
      const level=Math.max(.3,Math.min(1.32,.73+(p.oxygen-21)*.012));
      const air=p.ventilation/100;
      const flick=Math.sin(t*6)*.045+Math.sin(t*13)*.02;
      const visible=!p.extinguished;
      // Surface emitter: no numerical simulation; illustrative artwork only.
      ctx!.fillStyle="#9da9b8";ctx!.fillRect(cx-10,base,20,4);
      ctx!.fillStyle="#526578";ctx!.fillRect(cx-3,base+4,6,19);
      glow(cx,base,34,158,185,200,.14);
      if(visible) {
        if(p.world==="earth"){
          const H=Math.min(h*.51,130)*level;
          const xshift=air*24;
          glow(cx+xshift*.3,base-H*.48,Math.max(54,H*.9),255,117,35,.2+level*.07);
          ctx!.save();ctx!.globalCompositeOperation="screen";
          for(let layer=0;layer<4;layer++){
            const L=1-layer*.17;
            const hh=H*L*(1+flick);
            const rr=(21-layer*4)*level;
            const drift=Math.sin(t*(5+layer)+layer*.9)*(4-layer*.6);
            const tip=cx+xshift+drift;
            const grad=ctx!.createLinearGradient(cx,base-hh,cx,base);
            const colors=[
              ["rgba(255,75,26,.6)","rgba(255,139,43,.68)"],
              ["rgba(255,135,39,.85)","rgba(255,195,78,.9)"],
              ["rgba(255,210,88,.91)","rgba(255,243,175,.93)"],
              ["rgba(250,250,221,.95)","rgba(255,251,211,.95)"]
            ][layer];
            grad.addColorStop(0,colors[0]);grad.addColorStop(1,colors[1]);
            ctx!.fillStyle=grad;
            ctx!.beginPath();
            ctx!.moveTo(cx-rr,base);
            ctx!.bezierCurveTo(cx-rr*1.3,base-hh*.42,tip-rr*.5,base-hh*.76,tip,base-hh);
            ctx!.bezierCurveTo(tip+rr*.8,base-hh*.7,cx+rr*1.35,base-hh*.35,cx+rr,base);
            ctx!.closePath();ctx!.fill();
          }
          ctx!.restore();
        }else{
          const radius=Math.min(w*.27,72)*level;
          const dx=air*radius*.48;
          const shape=1+air*.68;
          const flicker=1+flick*.5;
          glow(cx+dx*.5,cy,radius*1.95,52,144,255,.22);
          ctx!.save();ctx!.translate(cx+dx,cy);ctx!.rotate(-air*.18);
          for(let layer=0;layer<3;layer++){
            const r=radius*(1-layer*.26);
            const g=ctx!.createRadialGradient(-r*.18,-r*.1,r*.08,0,0,r*1.08);
            if(layer===0){g.addColorStop(0,"rgba(127,239,255,.5)");g.addColorStop(.64,"rgba(20,164,251,.6)");g.addColorStop(1,"rgba(33,110,255,0)")}
            if(layer===1){g.addColorStop(0,"rgba(211,252,255,.76)");g.addColorStop(.65,"rgba(85,225,255,.78)");g.addColorStop(1,"rgba(8,140,235,.12)")}
            if(layer===2){g.addColorStop(0,"rgba(242,255,255,.94)");g.addColorStop(.7,"rgba(161,246,252,.78)");g.addColorStop(1,"rgba(170,244,255,0)")}
            ctx!.fillStyle=g;
            ctx!.beginPath();ctx!.ellipse(0,0,r*shape,r/flicker,0,0,Math.PI*2);ctx!.fill();
          }
          ctx!.restore();
        }
      }else {
        glow(cx,cy,32,130,177,188,.15);
      }
      // Flow arrows are conceptual mechanism diagrams.
      if(p.showMechanics){
        ctx!.strokeStyle=p.world==="earth"?"rgba(255,205,112,.72)":"rgba(113,226,252,.72)";
        ctx!.fillStyle=ctx!.strokeStyle;
        ctx!.lineWidth=1.7;
        if(p.world==="earth"){
          for(let j=-1;j<=1;j++){
            const x=cx+j*58;
            const top=base-100+(t*17%29);
            ctx!.beginPath();ctx!.moveTo(x,top+40);ctx!.lineTo(x,top);ctx!.lineTo(x-5,top+8);ctx!.moveTo(x,top);ctx!.lineTo(x+5,top+8);ctx!.stroke();
          }
        }else{
          for(let j=0;j<4;j++){
            const angle=j*Math.PI/2+.35,rad=Math.min(w*.31,96);
            const x=cx+Math.cos(angle)*rad,y=cy+Math.sin(angle)*rad;
            const theta=angle+Math.PI,dd=14;
            ctx!.beginPath();ctx!.moveTo(x,y);ctx!.lineTo(x+Math.cos(theta)*dd,y+Math.sin(theta)*dd);ctx!.stroke();
          }
        }
      }
      // Labels permanently tied to the environment, not to measured data.
      ctx!.textAlign="center";ctx!.font="600 11px system-ui";
      ctx!.fillStyle="rgba(220,234,250,.75)";
      ctx!.fillText(p.extinguished?"LLAMA APAGADA":p.world==="earth"?"CONVECCIÓN ↑":"DIFUSIÓN • VENTILACIÓN",cx,h-24);
      requestAnimationFrame(tick);
    }
    let raf=requestAnimationFrame(tick);
    return ()=>{alive=false;cancelAnimationFrame(raf);observer.disconnect()};
  },[]);
  return <canvas ref={canvasRef} role="img" aria-label={world==="earth"?"Ilustración animada de una llama alta por convección terrestre":"Ilustración animada de llama aproximadamente esférica en microgravedad"} className="block h-full w-full"/>;
}

const QUESTIONS=[
  {q:"En la Tierra, ¿por qué suele subir una llama?",options:["Porque el aire caliente asciende","Porque el fuego busca las estrellas","Porque la vela se mueve sola"],correct:0,explain:"¡Exacto! El aire calentado por la llama es menos denso y asciende. A ese movimiento lo llamamos convección."},
  {q:"¿Qué puede ocurrir con una llama tranquila en microgravedad?",options:["Siempre se apaga de inmediato","Puede verse redondeada y azulada","Se convierte en hielo"],correct:1,explain:"Sin flotabilidad apreciable, el oxígeno puede llegar por difusión. Eso permite llamas más redondas; una corriente de ventilación cambia su forma."},
  {q:"¿Por qué importa estudiar el humo en la ISS?",options:["Porque siempre va al techo","Porque puede viajar con la ventilación","Porque nunca existe humo"],correct:1,explain:"En microgravedad el humo no sube igual que en la Tierra. Los sistemas de ventilación ayudan a transportarlo hacia los detectores."},
];

const QUESTIONS_EN=[
  {q:"Why does a candle flame usually rise on Earth?",options:["Because warm air rises","Because fire seeks the stars","Because the candle moves itself"],correct:0,explain:"Exactly! Warm air is less dense and rises. This flow is called convection."},
  {q:"What can happen to a quiet flame in microgravity?",options:["It always goes out immediately","It may appear round and blue","It turns into ice"],correct:1,explain:"Without significant buoyancy, oxygen may reach the flame by diffusion. Ventilation can alter its shape."},
  {q:"Why is studying smoke important on the ISS?",options:["Because smoke always rises to the ceiling","Because ventilation carries smoke particles","Because smoke never occurs"],correct:1,explain:"Without normal buoyancy, smoke does not rise in the same way. Ventilation carries it toward sensors."},
];
export function FlamePlayground({onStudy}:{onStudy:(code:string)=>void}){
  const {t,language,reducedMotion}=useSicesPreferences();
  const [world,setWorld]=React.useState<GravityWorld>("earth");
  const [oxygen,setOxygen]=React.useState(21);
  const [ventilation,setVentilation]=React.useState(0);
  const [extinguished,setExtinguished]=React.useState(false);
  const [paused,setPaused]=React.useState(false);
  const [mechanics,setMechanics]=React.useState(true);
  const [compare,setCompare]=React.useState(true);
  const [quizIndex,setQuizIndex]=React.useState(0);
  const [choice,setChoice]=React.useState<number|null>(null);
  const [completed,setCompleted]=React.useState<boolean[]>([]);
  const q=language==="es"?QUESTIONS[quizIndex]:QUESTIONS_EN[quizIndex];
  function reset(){setWorld("earth");setOxygen(21);setVentilation(0);setExtinguished(false);setPaused(false);setMechanics(true);setCompare(true)}
  const button=(active:boolean)=>"rounded-xl px-4 py-2.5 text-sm font-semibold transition-all "+(active?"bg-amber-400 text-[#0a1629] shadow-[0_0_20px_rgba(251,191,36,.22)]":"bg-white/5 text-slate-300 hover:bg-white/10");
  return <div className="space-y-9">
    <div className="grid items-center gap-9 xl:grid-cols-[.76fr_1.24fr]">
      <div className="space-y-5">
        <span className="sices-pill">{t("01 / DESCUBRE • EXPERIMENTO VISUAL","01 / EXPLORE • VISUAL EXPERIMENT")}</span>
        <h2 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{t("Una llama.","One flame.")}<br/><span className="text-amber-300">{t("Dos mundos.","Two worlds.")}</span></h2>
        <p className="max-w-lg text-base leading-relaxed text-slate-300">{t("En la Tierra, el aire caliente sube y estira una llama. En microgravedad, sin esa corriente natural, algunas llamas pueden volverse pequeñas esferas azuladas.","On Earth, warm air rises and stretches a flame. In microgravity, without that natural airflow, some flames can become small blue spheres.")}</p>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-100/[.07] p-4 text-sm leading-relaxed">
          <p className="font-semibold text-amber-200">{t("¿Qué puedes cambiar?","What can you change?")}</p>
          <p className="mt-1 text-slate-300">{t("Selecciona la gravedad, mueve la ventilación, ajusta el oxígeno y observa cómo cambia esta","Change gravity, ventilation and oxygen, and watch this")} <strong>{t("representación visual","visual illustration")}</strong>.</p>
        </div>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-400"><Lightbulb size={16} className="mt-0.5 shrink-0 text-sky-300"/> <span><strong className="text-slate-200">{t("Importante:","Important:")}</strong> {t("esta animación no es un ensayo NASA ni resuelve ecuaciones de combustión. Su forma y tamaño son ilustrativos; no predicen inflamabilidad, temperatura ni un tiempo de extinción.","this animation is not a NASA experiment or a physical combustion model. Its shape and size are illustrative; it cannot predict ignition, temperature or extinction time.")}</span></p>
      </div>
      <div className="sices-glass overflow-hidden p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-xl bg-white/[.05] p-1">
            <button type="button" className={button(world==="earth")} onClick={()=>setWorld("earth")}>{t("🌍 Tierra","🌍 Earth")}</button>
            <button type="button" className={button(world==="space")} onClick={()=>setWorld("space")}>{t("🛰️ Microgravedad","🛰️ Microgravity")}</button>
          </div>
          <button type="button" onClick={()=>setCompare(v=>!v)} className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10" aria-pressed={compare}><ArrowLeftRight size={14}/>{compare?t("Vista individual","Single view"):t("Ver las dos","Show both")}</button>
        </div>
        <div className={"grid gap-3 "+(compare?"sm:grid-cols-2":"grid-cols-1")}>
          {(compare?["earth","space"] as GravityWorld[]:[world]).map(loc=><div key={loc} className={"overflow-hidden rounded-2xl border "+(world===loc?"border-amber-300/45":"border-white/10")}>
            <div className="relative h-[265px] sm:h-[315px]"><FlameCanvas world={loc} oxygen={oxygen} ventilation={ventilation} paused={paused||reducedMotion} extinguished={extinguished} showMechanics={mechanics}/><div className="absolute left-3 top-3 rounded-lg border border-white/10 bg-slate-950/65 px-2.5 py-1.5 text-[11px] font-semibold text-white">{loc==="earth"?t("01  •  GRAVEDAD 1g","01  •  1g GRAVITY"):t("02  •  MICROGRAVEDAD","02  •  MICROGRAVITY")}</div></div>
            <div className="bg-[#0a1a30] px-3 py-3 text-xs text-slate-300">{loc==="earth"?t("El aire caliente asciende → llama alargada.","Warm air rises → longer flame."):t("Sin convección por flotabilidad → puede ser esférica.","Without buoyancy-driven convection → potentially spherical.")}</div>
          </div>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button type="button" className="sices-ctl" onClick={()=>setPaused(v=>!v)}>{paused?<Play size={15}/>:<Pause size={15}/>} {paused?t("Reanudar","Resume"):t("Pausar","Pause")}</button>
            <button type="button" className="sices-ctl" onClick={reset}><RotateCcw size={15}/> Reiniciar</button>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={mechanics} onChange={e=>setMechanics(e.target.checked)}/> Mostrar corrientes de aire</label>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-slate-300"><span className="mb-2 flex justify-between"><span>{t("Oxígeno ambiental","Ambient oxygen")}</span><strong className="text-white">{oxygen}%</strong></span><input type="range" min={16} max={40} step={1} value={oxygen} onChange={e=>setOxygen(Number(e.target.value))} className="w-full accent-amber-300"/><span className="mt-1 block text-[10px] text-slate-500">{t("Solo control ilustrativo del dibujo","Visual illustration control only")}</span></label>
          <label className="block text-xs text-slate-300"><span className="mb-2 flex justify-between"><span className="flex items-center gap-1"><Wind size={13}/> Ventilación visual</span><strong className="text-white">{ventilation}%</strong></span><input type="range" min={0} max={100} step={5} value={ventilation} onChange={e=>setVentilation(Number(e.target.value))} className="w-full accent-sky-300"/><span className="mt-1 block text-[10px] text-slate-500">{t("Intensidad gráfica, no cm/s medidos","Visual intensity, not measured cm/s")}</span></label>
        </div>
        <button type="button" className={"mt-4 w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-colors "+(extinguished?"border-emerald-300/35 bg-emerald-300/10 text-emerald-200":"border-sky-300/35 bg-sky-300/10 text-sky-200 hover:bg-sky-300/20")} onClick={()=>setExtinguished(v=>!v)}>{extinguished?t("↻ Volver a encender el dibujo","↻ Relight illustration"):t("🧯 Apagar la llama ilustrada","🧯 Extinguish illustrated flame")}</button>
      </div>
    </div>
    <section className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <div className="sices-glass p-6 sm:p-8">
        <span className="sices-pill">{t("02 / MISIÓN INTERACTIVA","02 / INTERACTIVE MISSION")}</span>
        <h3 className="mt-4 text-2xl font-bold">{t("¿Puedes proteger una nave espacial?","Can you protect a spacecraft?")}</h3>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400"><span>{t("Pregunta","Question")} {quizIndex+1} {t("de","of")} {QUESTIONS.length}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-300 transition-all" style={{width:((quizIndex+1)/QUESTIONS.length*100)+"%"}}/></div><span>{completed.filter(Boolean).length} {t("aciertos","correct")}</span></div>
        <h4 className="mt-6 text-lg font-semibold">{q.q}</h4>
        <div className="mt-4 grid gap-2">{q.options.map((opt,i)=><button type="button" key={i} disabled={choice!==null} onClick={()=>{setChoice(i);setCompleted(p=>{const next=[...p];next[quizIndex]=i===q.correct;return next})}} className={"rounded-xl border px-4 py-3 text-left text-sm transition-colors "+(choice===null?"border-white/15 bg-white/[.04] hover:border-sky-300/50 hover:bg-sky-300/10":choice===i?(i===q.correct?"border-emerald-300/70 bg-emerald-400/15":"border-rose-300/70 bg-rose-400/10"):"border-white/10 text-slate-400")}>{String.fromCharCode(65+i)}. {opt}</button>)}</div>
        {choice!==null&&<div role="status" className="mt-4 rounded-xl border border-emerald-200/25 bg-emerald-200/10 p-4 text-sm"><p className="font-bold">{choice===q.correct?t("¡Correcto! 🌟","Correct! 🌟"):t("Casi. Mira la explicación:","Not quite. Here is why:")}</p><p className="mt-2 text-slate-200">{q.explain}</p><button type="button" className="mt-3 rounded-xl bg-amber-300 px-4 py-2 text-xs font-bold text-slate-950" onClick={()=>{setQuizIndex((quizIndex+1)%QUESTIONS.length);setChoice(null)}}>{quizIndex===QUESTIONS.length-1?t("Repetir misión","Restart mission"):t("Siguiente misión →","Next mission →")}</button></div>}
      </div>
      <div className="sices-glass p-6 sm:p-8">
        <span className="sices-pill">{t("03 / CIENCIA DE VERDAD","03 / REAL SCIENCE")}</span>
        <h3 className="mt-4 text-2xl font-bold">{t("Del dibujo al laboratorio","From illustration to laboratory")}</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{t("NASA estudia fuegos reales dentro de aparatos controlados. Estas investigaciones explican por qué la seguridad espacial necesita tres líneas de defensa.","NASA studies real combustion in controlled equipment. These studies show why spacecraft fire safety needs three layers of protection.")}</p>
        <div className="mt-5 space-y-3">{[
          {code:"PSI-26",name:"BASS",title:t("Evitar que el fuego se propague","Prevent flame spread"),icon:"🛡️"},
          {code:"PSI-102",name:"SAME",title:t("Detectar las partículas de humo","Detect smoke particles"),icon:"🔔"},
          {code:"PSI-69",name:"FLEX",title:t("Entender cómo se apaga una llama","Understand flame extinction"),icon:"🧯"}
        ].map(s=><button type="button" key={s.code} onClick={()=>onStudy(s.code)} className="group flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-left transition-all hover:border-amber-300/50 hover:bg-white/[.08]"><span className="flex items-center gap-3"><span className="text-xl">{s.icon}</span><span><strong className="block text-sm">{s.name}</strong><span className="block text-xs text-slate-400">{s.title}</span></span></span><ArrowUpRight size={16} className="text-slate-400 group-hover:text-amber-300"/></button>)}</div>
        <a className="mt-5 flex items-center gap-1 text-xs font-semibold text-sky-300 underline" href="https://www.nasa.gov/image-article/candle-flame-1g-vs-microgravity/" target="_blank" rel="noopener noreferrer">NASA: llama en 1g frente a microgravedad <ArrowUpRight size={13}/></a>
      </div>
    </section>
  </div>;
}
