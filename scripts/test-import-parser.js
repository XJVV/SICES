/**
 * Test del parser de importación contra los archivos reales PSI-117.
 * Compila src/lib/import-parser.ts a JS (tsc) y lo ejecuta sobre upload/*.csv.
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

const { parseAnalyzedCsv } = require(path.join(OUT, "import-parser.js"));

const dir = path.join(ROOT, "upload");
const files = fs
  .readdirSync(dir)
  .filter((f) => /\.csv$/i.test(f))
  .sort();

let totalSeries = 0;
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), "utf8");
  const res = parseAnalyzedCsv(f, text);
  console.log("=".repeat(90));
  console.log(`${f}`);
  console.log(`  psiCode: ${res.psiCode}  ·  dataset: ${res.dataset ? res.dataset.key : "—"}  ·  tag: ${res.dataset?.tag ?? "—"}`);
  if (res.error) console.log(`  ERROR: ${res.error}`);
  if (res.dataset) {
    totalSeries += res.dataset.series.length;
    console.log(`  series: ${res.dataset.series.length}  ·  condición: ${res.dataset.condition || "—"}`);
    for (const s of res.dataset.series) {
      const errs = s.points.filter((p) => p.length >= 4).length;
      console.log(
        `    - ${s.metric.padEnd(14)} ${s.xKind.padEnd(13)} x[${s.xUnit}] y[${s.yUnit}]  ${String(s.source).padEnd(11)} «${s.label}»  pts=${s.points.length}${errs ? ` (err=${errs})` : ""}`
      );
    }
  }
  for (const w of res.warnings) console.log(`    ⚠ ${w}`);
}

console.log("=".repeat(90));
console.log(`TOTAL SERIES: ${totalSeries} en ${files.length} archivos`);
