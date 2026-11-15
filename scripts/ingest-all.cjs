#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const root = process.cwd();
const local = process.env.PYTHON || (process.platform === "win32" ? "py" : "python3");
const command = process.platform === "win32" && !process.env.PYTHON ? ["-3"] : [];
const args = command.concat(["-m","sices.ingestion.batch_ingest",...process.argv.slice(2)]);
const env = {...process.env,PYTHONPATH:join(root,"python")};
const result = spawnSync(local,args,{cwd:root,env,stdio:"inherit",shell:false});
process.exit(result.status ?? 1);
