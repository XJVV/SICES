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
  assert.ok(data.investigations.some(x=>x.laymanSummary),"Missing educational summary");
  const sim=await fetch(url+"/api/simulator",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({o2Percent:21,pressurePsi:14.7,airflowCmS:null})});
  assert.equal(sim.status,200,"Simulator POST: "+await sim.text().catch(()=>"?"));
  const selected=data.investigations.slice(0,2);
  const compare=await fetch(url+"/api/compare?"+new URLSearchParams({a:String(selected[0].id),b:String(selected[1].id)}));
  assert.equal(compare.status,200,"Comparator GET: "+await compare.text().catch(()=>"?"));
  const pairs=await compare.json().catch(()=>({}));
  assert.equal(pairs.profiles?.length,2);
  const disabled=await fetch(url+"/api/import",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  assert.equal(disabled.status,410,"Public import must be disabled");
  process.stdout.write("SICES smoke OK: 4 presets, NASA-only catalog, simulator, compare, import disabled.\n");
}
test().catch(e=>{process.stderr.write(String(e.stack||e)+"\n");process.exitCode=1}).finally(()=>{worker.kill("SIGTERM")});
