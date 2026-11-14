#!/usr/bin/env node
/**
 * SICES · ensure-db — Auto-sanado de la base de datos SQLite.
 *
 * Garantiza que exista <proyecto>/db/custom.db con esquema y datos semilla,
 * funcione o no el archivo .env (p. ej. tras copiar el proyecto a otra máquina
 * con una ruta absoluta heredada de otro equipo).
 *
 * Se ejecuta automáticamente antes de `npm run dev` y `npm start` (hooks
 * predev/prestart) y se puede lanzar manualmente con `npm run db:setup`.
 */
const { spawnSync } = require("child_process");
const { existsSync, mkdirSync, statSync } = require("fs");
const { join } = require("path");

const root = process.cwd();
const dbDir = join(root, "db");
const dbFile = join(dbDir, "custom.db");
const dbUrl = "file:" + dbFile.replace(/\\/g, "/");
const env = Object.assign({}, process.env, { DATABASE_URL: dbUrl });

function log(msg) {
  console.log("[ensure-db] " + msg);
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    console.error("[ensure-db] ERROR al ejecutar: " + cmd + " " + args.join(" "));
    process.exit(1);
  }
}

function countInvestigations() {
  const probe =
    "const {PrismaClient}=require('@prisma/client');" +
    "const db=new PrismaClient({datasources:{db:{url:" + JSON.stringify(dbUrl) + "}}});" +
    "db.investigation.count().then(async c=>{console.log(c);await db.$disconnect();})" +
    ".catch(e=>{console.error(e.message);process.exit(1);});";
  const res = spawnSync("node", ["-e", probe], { encoding: "utf8", env });
  if (res.status !== 0) return null;
  const n = parseInt(String(res.stdout || "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function applySchema() {
  run("npx", ["prisma", "db", "push", "--skip-generate"]);
}

// 1) Archivo de BD ausente o vacío -> crear directorio y aplicar esquema
if (!existsSync(dbFile) || statSync(dbFile).size === 0) {
  log("No se encontró db/custom.db en " + root);
  mkdirSync(dbDir, { recursive: true });
  log("Aplicando esquema de Prisma (db push)...");
  applySchema();
}

// 2) Comprobar conectividad y datos; reintentar esquema si hace falta
let count = countInvestigations();
if (count === null) {
  log("Las tablas no existen; aplicando esquema de nuevo...");
  applySchema();
  count = countInvestigations();
  if (count === null) {
    console.error("[ensure-db] No se pudo inicializar la base de datos. Revisa la instalación de Prisma (npm install).");
    process.exit(1);
  }
}

// 3) BD sin datos -> cargar semilla (14 investigaciones NASA PSI + telemetría)
if (count === 0) {
  log("Base de datos vacía. Cargando datos semilla...");
  const seedJs = join(root, "prisma", "seed.js");
  if (existsSync(seedJs)) {
    run("node", [seedJs]);
  } else {
    // Respaldo: usar tsx/bun si seed.js no está compilado
    run("npx", ["--yes", "tsx", join(root, "prisma", "seed.ts")]);
  }
  count = countInvestigations();
}

log("Base de datos lista (" + count + " investigaciones): " + dbFile);
