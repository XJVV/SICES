#!/usr/bin/env node
/* Check real SICES API responses against curated local SQLite. */
const {spawn}=require("node:child_process");
const assert=require("node:assert/strict");
const port=3187;
const url="http://127.0.0.1:"+port;
const worker=spawn(process.execPath,[".next/standalone/server.js"],{
  env:{...process.env,PORT:String(port),HOSTNAME:"127.0.0.1",NODE_ENV:"production"},
  stdio:["ignore","pipe","pipe"]
});
let output="";
worker.stdout.on("data",b=>{output+=String(b).slice(0,300)});
worker.stderr.on("data",b=>{output+=String(b).slice(0,300)});
const pause=t=>new Promise(resolve=>setTimeout(resolve,t));
async function test(){
  let response;
  for(let i=0;i<40;i++){
    try{response=await fetch(url+"/api/observatory",{signal:AbortSignal.timeout(1200)});break}
    catch{if(worker.exitCode!==null)break;await pause(250)}
  }
  assert.ok(response,"Server unavailable: "+output.slice(-700));
  assert.equal(response.status,200,"Observatory GET");
  const data=await response.json();
  assert.ok(data.scenarios.length>=4,"Missing source-backed scenario presets");
  assert.ok(data.investigations.length>=2,"Missing NASA studies");
  assert.ok(data.investigations.every(x=>x.agency==="NASA_PSI"));
  assert.equal(data.available.agencies,undefined,"No multiagency catalog.");
  const curves=await fetch(url+"/api/series");
  assert.equal(curves.status,200,"Verified real series endpoint");
  const catalogs=await curves.json();
  assert.ok(catalogs.length>0,"NASA PSI experimental datasets missing.");
  assert.ok(catalogs.every(c=>c.provenance?.agency==="NASA_PSI" && c.series.every(s=>s.source==="EXPERIMENT")));
  const totalCurves=catalogs.reduce((sum,c)=>sum+c.series.length,0);
  assert.ok(totalCurves>0);
  const seriesId=catalogs[0].series[0].id;
  const original=await fetch(url+"/api/series/export?seriesId="+seriesId);
  assert.equal(original.status,200,"Source-backed raw series export");
  const exportText=await original.text();
  assert.ok(exportText.includes("NASA PSI")&&exportText.includes("Archivo")&&exportText.split("\n").length>=4);
  const home=await fetch(url+"/");
  assert.equal(home.status,200,"New home renders");
  const html=await home.text();
  assert.ok(html.includes("Aprender jugando")&&html.includes("Laboratorio científico")&&html.includes("Dos mundos"),"New dual experience present");

  const alien=await fetch(url+"/api/observatory?agency=JAXA_KIBO");
  assert.equal(alien.status,200);
  assert.ok((await alien.json()).investigations.every(x=>x.agency==="NASA_PSI"));
  assert.ok(data.investigations.some(x=>x.laymanSummary),"Missing educational summary");
  const sim=await fetch(url+"/api/simulator",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({o2Percent:21,pressurePsi:14.7,airflowCmS:null})});
  assert.equal(sim.status,200,"Simulator POST: "+await sim.text().catch(()=>"?"));
  const selected=data.investigations.slice(0,2);
  const compare=await fetch(url+"/api/compare?"+new URLSearchParams({a:String(selected[0].id),b:String(selected[1].id)}));
  const pairs=await compare.json().catch(()=>({}));
  assert.equal(compare.status,200,"Comparator GET: "+JSON.stringify(pairs));
  assert.equal(pairs.profiles?.length,2);
  const disabled=await fetch(url+"/api/import",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  assert.equal(disabled.status,410,"Public import must be disabled");
  process.stdout.write("SICES final smoke OK: "+totalCurves+" source-backed curves, raw export, NASA-only catalog, education, simulator, comparison.\n");
}
test().catch(e=>{process.stderr.write(String(e.stack||e)+"\n");process.exitCode=1}).finally(()=>{worker.kill("SIGTERM")});
