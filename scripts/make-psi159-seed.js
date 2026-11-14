/**
 * Genera prisma/data/psi159_cfig.json — los datasets del PSI-159 (ACME CFI-G)
 * a partir de las tablas experimentales reales subidas por el usuario, usando
 * el mismo parser que el endpoint de importación. Así el seed puede crearlos
 * sin depender del parser en tiempo de ejecución.
 *
 * Uso: node scripts/make-psi159-seed.js
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, ".parser-build");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

execSync(
  `npx tsc src/lib/import-parser.ts --outDir "${OUT}" --module commonjs --target es2020 --skipLibCheck --moduleResolution node`,
  { cwd: ROOT, stdIO: "inherit" }
);

const { parseAnalyzedCsv } = require(path.join(OUT, "import-parser.js"));

const FILES = [
  "PSI-159_Experimental table_CFI-G_Inverse Flames.csv",
  "PSI-159_Experimental table_CFI-G_Normal Flames.csv",
];

const datasets = [];
for (const f of FILES) {
  const text = fs.readFileSync(path.join(ROOT, "upload", f), "utf8");
  const res = parseAnalyzedCsv(f, text);
  if (res.error || !res.dataset) {
    console.error(`✘ ${f}: ${res.error}`);
    process.exit(1);
  }
  const d = res.dataset;
  datasets.push({
    key: d.key,
    nameEs: d.nameEs,
    nameEn: d.nameEn,
    tag: d.tag,
    fuel: d.fuel,
    condition: d.condition,
    doi: "",
    reference: d.reference,
    sort: 100 + datasets.length,
    series: d.series.map((s, i) => ({
      metric: s.metric,
      xKind: s.xKind,
      xUnit: s.xUnit,
      yUnit: s.yUnit,
      label: s.label,
      source: s.source,
      sort: i,
      points: s.points,
    })),
  });
  console.log(
    `  ✓ ${f} → ${d.key} (${d.series.length} series, ${d.series.reduce((a, s) => a + s.points.length, 0)} puntos)`
  );
}

const payload = { datasets };
const dest = path.join(ROOT, "prisma", "data", "psi159_cfig.json");
fs.writeFileSync(dest, JSON.stringify(payload));
console.log(`Escrito: ${dest} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
