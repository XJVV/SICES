#!/usr/bin/env node
/**
 * SICES — Importación masiva de datos analizados NASA PSI por línea de
 * comandos. Requiere el servidor de desarrollo activo (npm run dev).
 *
 * Uso:
 *   node scripts/import-csv.mjs <archivo1.csv> <archivo2.csv> ...
 *   node scripts/import-csv.mjs upload/*.csv --psi PSI-159
 *   node scripts/import-csv.mjs archivo.csv --dry          (solo analizar)
 *   node scripts/import-csv.mjs archivo.csv \
 *     --meta '{"PSI-159":{"shortName":"FLEX-2","investigator":"..."}}'
 *
 * Opciones:
 *   --url URL   servidor (por defecto http://localhost:3000)
 *   --psi CODE  código PSI para archivos sin código en el nombre
 *   --dry       analizar sin escribir en la base de datos
 *   --meta JSON metadatos para investigaciones nuevas
 */

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const BASE = (() => {
  const i = args.indexOf("--url");
  return i >= 0 ? args.splice(i, 2)[1] : "http://localhost:3000";
})();
const PSI = (() => {
  const i = args.indexOf("--psi");
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
})();
const DRY = (() => {
  const i = args.indexOf("--dry");
  if (i >= 0) {
    args.splice(i, 1);
    return true;
  }
  return false;
})();
const META = (() => {
  const i = args.indexOf("--meta");
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
})();

const files = args.filter((a) => !a.startsWith("--"));
if (files.length === 0) {
  console.log(`SICES — importación de datos analizados (NASA PSI)

Uso:
  node scripts/import-csv.mjs <archivo1.csv> [archivo2.csv ...]
  node scripts/import-csv.mjs datos/*.csv --psi PSI-159
  node scripts/import-csv.mjs archivo.csv --dry

Opciones:
  --url URL    servidor (por defecto ${BASE})
  --psi CODE   código PSI para archivos sin código en el nombre
  --dry        solo analizar, sin escribir en la base de datos
  --meta JSON  metadatos de investigaciones nuevas, p. ej.
               '{"PSI-159":{"shortName":"FLEX-2","name":"..."}}'`);
  process.exit(0);
}

// 1. comprobar servidor
try {
  const res = await fetch(`${BASE}/api/investigations`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
} catch {
  console.error(
    `✖ No se pudo conectar con ${BASE}.\n` +
      "  Arranca el servidor primero:  npm run dev\n" +
      "  (o indica otro con --url http://localhost:PUERTO)"
  );
  process.exit(1);
}

// 2. construir el formulario
const form = new FormData();
for (const f of files) {
  const content = readFileSync(f);
  const name = f.split(/[\\/]/).pop();
  form.append("files", new Blob([content], { type: "text/csv" }), name);
}
if (PSI) form.append("psi", PSI);
if (META) form.append("meta", META);
if (DRY) form.append("dry", "1");

// 3. importar
console.log(
  `→ ${DRY ? "Analizando" : "Importando"} ${files.length} archivo(s) en ${BASE}…\n`
);
const res = await fetch(`${BASE}/api/import`, { method: "POST", body: form });
if (!res.ok) {
  console.error(`✖ Error HTTP ${res.status}`);
  process.exit(1);
}
const data = await res.json();

const ICON = { ok: "✔", skip: "·", err: "✖" };
for (const r of data.results) {
  const status = !r.ok ? "err" : r.dataset?.skipped ? "skip" : "ok";
  const lines = [];
  if (status === "err") lines.push(`  ${ICON.err} ${r.fileName} — ${r.error}`);
  else if (status === "skip")
    lines.push(`  ${ICON.skip} ${r.fileName} — ya existía, omitido (${r.psiCode})`);
  else {
    lines.push(
      `  ${ICON.ok} ${r.fileName} — ${r.dataset.seriesCount} series · ${r.dataset.pointsTotal.toLocaleString()} puntos (${r.psiCode}${r.investigationCreated ? " · investigación nueva" : ""})`
    );
    for (const s of r.dataset.series) {
      lines.push(
        `       · ${s.metric.padEnd(16)} ${String(s.source).padEnd(11)} «${s.label}»  ${s.points} pts`
      );
    }
  }
  for (const w of r.warnings ?? []) lines.push(`       ⚠ ${w}`);
  console.log(lines.join("\n"));
}

const s = data.summary;
console.log(
  `\nResumen: ${s.ok}/${s.files} archivos ok · ${s.datasetsCreated} conjuntos nuevos · ${s.seriesCreated} series · ${s.pointsCreated.toLocaleString()} puntos` +
    (s.investigationsCreated ? ` · ${s.investigationsCreated} investigaciones creadas` : "") +
    (s.datasetsSkipped ? ` · ${s.datasetsSkipped} omitidos` : "")
);
if (DRY) console.log("(modo análisis: no se escribió nada en la base de datos)");
else if (data.createdDatasetKeys.length > 0)
  console.log(
    `Claves creadas (para deshacer):\n  ${data.createdDatasetKeys.join(", ")}`
  );
