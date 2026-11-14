/**
 * Debug del parser: estructura de bloques, cabeceras y unidades por archivo.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, ".parser-build");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
execSync(
  `npx tsc src/lib/import-parser.ts --outDir "${OUT}" --module commonjs --target es2020 --skipLibCheck --moduleResolution node`,
  { cwd: ROOT, stdio: "pipe" }
);
const P = require(path.join(OUT, "import-parser.js"));

const target = process.argv[2] || "Three_Stage";
const dir = path.join(ROOT, "upload");
const files = fs.readdirSync(dir).filter((f) => /\.csv$/i.test(f) && f.includes(target));

for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), "utf8");
  const rows = P.parseDelimited(text);
  console.log(`\n### ${f}  (${rows.length} filas)`);

  // columnas vacías
  const maxCols = Math.max(...rows.map((r) => r.length));
  const emptyCols = [];
  for (let c = 0; c < maxCols; c++) {
    if (rows.every((r) => (r[c] ?? "") === "")) emptyCols.push(c);
  }
  console.log(`Columnas vacías (separadores): [${emptyCols.join(", ")}]`);

  const blocks = P.splitColumnBlocks ? P.splitColumnBlocks(rows) : [];
  console.log(`Bloques: ${blocks.length}`);
  for (const b of blocks) {
    const headers = [];
    for (let c = b.start; c <= b.end; c++) headers.push(`c${c}='${(rows[0] ?? [])[c] ?? ""}'`);
    // primeras 2 filas de datos
    const r1 = [];
    const r2 = [];
    for (let c = b.start; c <= b.end; c++) {
      r1.push((rows[1] ?? [])[c] ?? "");
      r2.push((rows[2] ?? [])[c] ?? "");
    }
    console.log(`  [${b.start}-${b.end}] HDR: ${headers.join(" | ")}`);
    console.log(`           R1 : ${r1.join(" | ")}`);
    console.log(`           R2 : ${r2.join(" | ")}`);
    // inferencias
    for (let c = b.start; c <= b.end; c++) {
      const h = (rows[0] ?? [])[c] ?? "";
      const x = P.__inferXDebug ? P.__inferXDebug(h) : null;
      if (h) console.log(`           c${c} '${h}' → X:${x ? x.xKind : "no"}  unidad:${JSON.stringify(x ? x.unit : "")}`);
    }
  }

  const res = P.parseAnalyzedCsv(f, text);
  console.log(`\nResultado: ${res.dataset ? res.dataset.series.length + " series" : res.error}`);
  if (res.dataset) {
    for (const s of res.dataset.series) {
      console.log(
        `  - ${s.metric} ${s.xKind} xUnit=${JSON.stringify(s.xUnit)} yUnit=${JSON.stringify(s.yUnit)} «${s.label}» ${s.source} pts=${s.points.length}`
      );
    }
  }
  for (const w of res.warnings) console.log(`  ⚠ ${w}`);
}
