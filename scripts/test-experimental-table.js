/**
 * Test del parser de «Experimental table» (PSI-159 CFI-G) contra los
 * archivos reales subidos por el usuario, y regresión de los
 * «Analyzed Data» del PSI-117.
 *
 * Compila src/lib/import-parser.ts a JS (tsc) y lo ejecuta sobre upload/.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, ".parser-build");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

execSync(
  `npx tsc src/lib/import-parser.ts --outDir "${OUT}" --module commonjs --target es2020 --skipLibCheck --moduleResolution node`,
  { cwd: ROOT, stdio: "inherit" }
);

const { parseAnalyzedCsv, looksLikeExperimentalTable, parseDelimited, importHints } =
  require(path.join(OUT, "import-parser.js"));

const dir = path.join(ROOT, "upload");
let failures = 0;
const check = (cond, msg) => {
  if (cond) console.log(`  ✔ ${msg}`);
  else {
    failures++;
    console.error(`  ✘ FALLO: ${msg}`);
  }
};

/* ------------------------- tablas experimentales ------------------------- */

const tableFiles = [
  "PSI-159_Experimental table_CFI-G_Inverse Flames.csv",
  "PSI-159_Experimental table_CFI-G_Normal Flames.csv",
];

const parsedByFile = new Map();

console.log("\n================ TABLAS EXPERIMENTALES (PSI-159 CFI-G) ================\n");
for (const f of tableFiles) {
  const text = fs.readFileSync(path.join(dir, f), "utf8");
  const rows = parseDelimited(text);
  check(looksLikeExperimentalTable(rows, f) === true, `${f}: detectada como tabla experimental`);

  const res = parseAnalyzedCsv(f, text);
  parsedByFile.set(f, res);
  console.log(`\n--- ${f}`);
  console.log(`  psiCode=${res.psiCode}  error=${res.error ?? "—"}  hints=${JSON.stringify(res.hints)}`);
  check(res.error === undefined, "sin error");
  check(res.psiCode === "PSI-159", "código PSI-159");
  check(res.hints && res.hints.combustionType === "GASEOUS", "hint combustión GASEOUS (CFI-G)");
  check(res.hints && res.hints.shortName === "CFI-G", "hint shortName CFI-G");

  const d = res.dataset;
  check(!!d, "dataset generado");
  if (!d) continue;
  console.log(`  dataset: key=${d.key}`);
  console.log(`  nombre=${d.nameEs} · tag=${d.tag} · fuel=${d.fuel} · condición=${d.condition}`);
  console.log(`  series=${d.series.length} · puntos=${d.series.reduce((a, s) => a + s.points.length, 0)}`);
  console.log(`  avisos: ${res.warnings.join(" | ") || "—"}`);

  // desglose por métrica
  const byMetric = new Map();
  for (const s of d.series) {
    if (!byMetric.has(s.metric)) byMetric.set(s.metric, []);
    byMetric.get(s.metric).push(s);
  }
  for (const [m, ss] of byMetric) {
    const pts = ss.reduce((a, s) => a + s.points.length, 0);
    console.log(
      `    ${m.padEnd(14)} xKind=${ss[0].xKind.padEnd(13)} xUnit=${ss[0].xUnit.padEnd(4)} yUnit=${ss[0].yUnit.padEnd(5)} series=[${ss
        .map((s) => `${s.label}:${s.points.length}`)
        .join(", ")}] pts=${pts}`
    );
  }

  // validaciones específicas por archivo
  if (f.includes("Inverse")) {
    check(d.key === "psi_159_cfi_g_inverse_flames", `key correcta (${d.key})`);
    check(d.tag === "Importado · Inverse", `tag «Importado · Inverse» (${d.tag})`);
    // fila 2 del CSV: 21196 A2 → p=1.10, burn time=35, ethane
    const bt = d.series.filter((s) => s.metric === "burntime_p");
    const ethane = bt.find((s) => s.label === "Ethane");
    check(!!ethane, "serie burntime_p Ethane existe");
    if (ethane) {
      check(ethane.points.some((p) => p[0] === 1.1 && p[1] === 35), "punto [1.10 bar, 35 s] (test 21196 A2) presente");
      // la fila 1 (21196 A1, ignición No, burn 0) no debe aparecer
      check(!ethane.points.some((p) => p[0] === 1.1 && p[1] === 0), "prueba sin ignición (21196 A1) omitida en burntime");
    }
    const groups = new Set(d.series.map((s) => s.label));
    check([...groups].join(",") === "Ethane,Propane,Butane", `grupos por combustible: ${[...groups].join(",")}`);
    check(byMetric.has("peaktempk_p") && byMetric.has("peaktemp_p"), "columnas T pico K y °C distinguibles");
    check(byMetric.has("hcrate_p") && byMetric.get("hcrate_p")[0].yUnit === "mg/s", "HC burnrate → hcrate mg/s");
    check(byMetric.has("tad_o2") && byMetric.get("tad_o2")[0].xKind === "xo2", "variante vs X_O2 generada");
    check(![...byMetric.keys()].some((m) => /tfp|day|test|fuel/.test(m)), "sin métricas basura (TFP/Day/Test)");
  } else {
    check(d.key === "psi_159_cfi_g_normal_flames", `key correcta (${d.key})`);
    check(d.tag === "Importado · Normal", `tag «Importado · Normal» (${d.tag})`);
    const bt = d.series.filter((s) => s.metric === "burntime_p");
    check(bt.length === 6, `burntime_p con 6 combustibles (${bt.length})`);
    // fila 1 del CSV Normal: 21088A1 → p=0.9443956, burn=50, ethane
    const ethane = bt.find((s) => s.label === "Ethane");
    check(!!ethane && ethane.points.some((p) => Math.abs(p[0] - 0.9443956) < 1e-9 && p[1] === 50), "punto [0.944 bar, 50 s] (21088A1) presente");
    // mHC (mg/s) → hcrate
    check(byMetric.has("hcrate_p"), "mHC → hcrate_p");
    // Xf → xf
    check(byMetric.has("xf_p"), "Xf → xf_p");
    // XO2 after test → xo2_after
    check(byMetric.has("xo2_after_p"), "XO2 after test → xo2_after_p");
  }
}

/* ---------------- archivo renombrado sin código ni «table» --------------- */

console.log("\n---------------- archivo renombrado («Normal Flames.csv») ----------------");
{
  const src = path.join(dir, tableFiles[1]);
  const text = fs.readFileSync(src, "utf8");
  const rows = parseDelimited(text);
  check(looksLikeExperimentalTable(rows, "Normal Flames.csv") === true, "detectada sin «Experimental table» en el nombre");
  const res = parseAnalyzedCsv("Normal Flames.csv", text, "PSI-159");
  check(res.error === undefined && !!res.dataset, `parsea con psi override (${res.error ?? "ok"})`);
  if (res.dataset) {
    check(res.dataset.nameEs === "Normal Flames", `nombre dataset «Normal Flames» (${res.dataset.nameEs})`);
    check(res.dataset.key === "psi_159_normal_flames", `key única (${res.dataset.key})`);
    check(res.dataset.series.length > 20, `${res.dataset.series.length} series generadas`);
  }
}

/* -------------------- idempotencia (re-importar) ------------------------ */

console.log("\n---------------- idempotencia ----------------");
{
  const text = fs.readFileSync(path.join(dir, tableFiles[0]), "utf8");
  const a = parseAnalyzedCsv(tableFiles[0], text);
  const b = parseAnalyzedCsv(tableFiles[0], text);
  check(a.dataset.key === b.dataset.key, "misma clave al re-importar");
}

/* ------------------- regresión: Analyzed Data PSI-117 ------------------- */

console.log("\n================ REGRESIÓN «Analyzed Data» (PSI-117) =================\n");
{
  const analyzed = fs
    .readdirSync(dir)
    .filter((f) => /Analyzed Data.*\.csv$/i.test(f))
    .sort();
  let ok = 0;
  let totalSeries = 0;
  for (const f of analyzed) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    const rows = parseDelimited(text);
    const isTable = looksLikeExperimentalTable(rows, f);
    if (isTable) console.error(`  ✘ ${f}: ¡marcado erróneamente como tabla!`);
    check(isTable === false, `${f}: NO se confunde con tabla experimental`);
    const res = parseAnalyzedCsv(f, text);
    if (res.dataset) {
      ok++;
      totalSeries += res.dataset.series.length;
      console.log(`  ${f}: ${res.dataset.series.length} series · ${res.dataset.series.reduce((a, s) => a + s.points.length, 0)} pts`);
    } else {
      failures++;
      console.error(`  ✘ ${f}: ${res.error}`);
    }
  }
  check(ok === analyzed.length, `los ${analyzed.length} archivos Analyzed Data siguen parseando`);
  console.log(`  total series Analyzed Data: ${totalSeries}`);
}

console.log(`\n${failures === 0 ? "✔ TODO OK" : `✘ ${failures} FALLOS`}\n`);
process.exit(failures === 0 ? 0 : 1);
