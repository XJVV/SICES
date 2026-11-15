#!/usr/bin/env node
const {spawnSync}=require("node:child_process");
const {join}=require("node:path");
const python=process.env.PYTHON||(process.platform==="win32"?"py":"python3");
const args=[...(process.platform==="win32"&&!process.env.PYTHON?["-3"]:[]),"-m","unittest","discover","-s","python/tests","-p","test_batch_ingest.py"];
const res=spawnSync(python,args,{cwd:process.cwd(),stdio:"inherit",env:{...process.env,PYTHONPATH:join(process.cwd(),"python")}});
process.exit(res.status??1);
