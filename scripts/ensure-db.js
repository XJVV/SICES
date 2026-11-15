#!/usr/bin/env node
/** Prepare the configured SQLite file without populating fictional seed experiments. */
const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const root = process.cwd();
function environmentUrl() {
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return null;
  const match = fs.readFileSync(file,"utf8").match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n#]+)["']?/m);
  return match?.[1]?.trim() || null;
}
const url = process.env.DATABASE_URL || environmentUrl() || "file:../db/custom.db";
if (!url.startsWith("file:")) { console.error("SICES requiere SQLite con DATABASE_URL=file:..."); process.exit(1); }
const filePart = url.slice(5).split("?")[0];
const target = path.resolve(path.isAbsolute(filePart)?filePart:path.join(root,"prisma",filePart));
fs.mkdirSync(path.dirname(target),{recursive:true});
const env = {...process.env,DATABASE_URL:"file:"+target.replace(/\\/g,"/")};
const result = spawnSync(process.platform==="win32"?"npx.cmd":"npx",["prisma","db","push"],{cwd:root,env,stdio:"inherit"});
if(result.status!==0)process.exit(result.status||1);
console.log("[SICES] Base preparada:",target);
console.log("[SICES] Para cargar datasets reales: npm run ingest:batch");
