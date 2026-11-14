/**
 * Parser de archivos de datos del repositorio NASA PSI. Soporta dos formatos:
 *
 * 1. «Analyzed Data» (CSV exportados de Excel): varios bloques de datos lado
 *    a lado separados por columnas vacías. Cada bloque tiene una fila de
 *    cabecera, una columna X (tiempo, presión, diámetro…) y una o varias
 *    columnas Y. Se detectan los bloques, se infiere la métrica y las
 *    unidades y se producen series (x, y) superponibles por métrica. Los
 *    bloques «ErrorBar+» / «ErrorBar-» se fusionan como límites de error.
 *
 * 2. «Experimental table» (p. ej. ACME CFI-G, PSI-159): una única tabla
 *    donde cada FILA es una prueba y cada columna una condición o
 *    resultado (presión, X_O2, caudal, T adiabática, tiempo de
 *    combustión…). Se convierte a series dispersas por combustible usando
 *    como eje X la presión y/o X_O2.
 */

/* ------------------------------------------------------------------ */
/* Tipos de salida                                                     */
/* ------------------------------------------------------------------ */

export type SeriesSource = "EXPERIMENT" | "SIMULATION" | "MODEL";

export interface ParsedSeries {
  metric: string;
  xKind: string; // time_s | time_norm | pressure_atm | diameter_mm
  xUnit: string;
  yUnit: string;
  label: string;
  source: SeriesSource;
  /** [x, y] o [x, y, errSup, errInf] (límites absolutos) */
  points: number[][];
}

export interface ParsedDataset {
  key: string;
  nameEs: string;
  nameEn: string;
  tag: string;
  fuel: string;
  condition: string;
  reference: string;
  series: ParsedSeries[];
}

export interface ParsedFile {
  fileName: string;
  psiCode: string | null;
  dataset: ParsedDataset | null;
  warnings: string[];
  error?: string;
  /** sugerencias de metadata (tipo de combustión, nombre…) para crear la
   *  investigación automáticamente al importar */
  hints?: ImportHints;
}

/* ------------------------------------------------------------------ */
/* Tokenizer CSV                                                       */
/* ------------------------------------------------------------------ */

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join("\n");
  const counts: Record<string, number> = {
    ",": (sample.match(/,/g) ?? []).length,
    ";": (sample.match(/;/g) ?? []).length,
    "\t": (sample.match(/\t/g) ?? []).length,
  };
  let best = ",";
  let bestCount = 0;
  for (const [d, n] of Object.entries(counts)) {
    if (n > bestCount) {
      best = d;
      bestCount = n;
    }
  }
  return bestCount === 0 ? "," : best;
}

export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const delim = detectDelimiter(lines);
  const rows: string[][] = [];
  for (const line of lines) {
    const row: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            quoted = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === delim) {
        row.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    row.push(cur);
    rows.push(row.map((c) => c.trim()));
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Normalización de cabeceras                                          */
/* ------------------------------------------------------------------ */

const UNIT_MAP: Array<[RegExp, string]> = [
  [/mm\^?2\s*\/\s*s(ec)?/i, "mm²/s"],
  [/s\s*\/\s*mm\^?2/i, "s/mm²"],
  [/mm\^?2/i, "mm²"],
  [/\bmm\b/i, "mm"],
  [/\batm\b/i, "atm"],
  [/\bs(ec)?\b/i, "s"],
  [/\bw(att)?\b/i, "W"],
  [/\bk(elvin)?\b/i, "K"],
  [/w\s*\/\s*cm\^?2/i, "W/cm²"],
];

function normalizeUnit(raw: string): string {
  let u = raw.trim();
  if (u === "") return "";
  for (const [re, rep] of UNIT_MAP) {
    if (re.test(u)) {
      // conservar coincidencias específicas primero (orden de UNIT_MAP)
      return u.replace(re, rep).replace(/\s+/g, " ").trim();
    }
  }
  return u;
}

/** Unidades plausibles tras normalizar; si el paréntesis final no parece una
 *  unidad (p. ej. «Cool Flame Dia (HWFM)»), se descarta. */
const PLAUSIBLE_UNITS = new Set([
  "", "-", "s", "mm", "mm²", "mm²/s", "s/mm²", "atm", "W", "K", "°C",
  "W/cm²", "ppm", "%", "cm", "cm/s", "cm²/s", "bar", "kPa", "mol/l",
]);

/** Divide una cabecera en (nombre, unidad) usando paréntesis finales. */
function splitHeaderUnit(h: string): { name: string; unit: string } {
  const m = h.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (m && m[1].trim() !== "") {
    const unit = normalizeUnit(m[2]);
    return PLAUSIBLE_UNITS.has(unit)
      ? { name: m[1].trim(), unit }
      : { name: h.trim(), unit: "" };
  }
  return { name: h.trim(), unit: "" };
}

/** Normaliza un nombre de columna para comparación: minúsculas, sin ^ ni
 *  espacios, y con paréntesis desarrollados: t/(Do)2 → tdo2. */
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/₀/g, "0")
    .replace(/\^/g, "")
    .replace(/\(([^()]+)\)/g, "$1")
    .replace(/[\s_-]+/g, "")
    .trim();
}

function isNumericCell(s: string): boolean {
  if (s === "" || s === null || s === undefined) return false;
  return !Number.isNaN(Number(s));
}

/* ------------------------------------------------------------------ */
/* Registro de ejes X y métricas Y                                     */
/* ------------------------------------------------------------------ */

interface XDef {
  xKind: string;
  unit: string;
  test: (n: string) => boolean;
}

const X_DEFS: XDef[] = [
  {
    xKind: "time_norm",
    unit: "s/mm²",
    test: (n) => /^t\/d[o0]/.test(n) || /^t\(d[o0]\)/.test(n) || /^td[o0]2/.test(n),
  },
  {
    xKind: "time_s",
    unit: "s",
    test: (n) =>
      n === "t" || n === "times" || n === "timesec" || n === "tsec" ||
      /^time/.test(n) || /^t\s*\(s\)/.test(n) || n === "elapsedtime",
  },
  {
    xKind: "pressure_atm",
    unit: "atm",
    test: (n) => n === "p" || n === "pressure" || /^p\(atm\)/.test(n) || /^pressure/.test(n),
  },
  {
    xKind: "diameter_mm",
    unit: "mm",
    test: (n) =>
      n === "do" || n === "d0" || n === "dinitial" || n === "dinicial" ||
      /^initialdiameter/.test(n) || /^diameter0/.test(n),
  },
];

export function inferX(header: string): XDef | null {
  const { name, unit } = splitHeaderUnit(header);
  const n = normName(name);
  for (const def of X_DEFS) {
    if (def.test(n)) {
      return { ...def, unit: unit || def.unit };
    }
  }
  return null;
}

type YMeaning =
  | "d2" | "d2_norm" | "diameter" | "dflame" | "dflame_ratio" | "coolflame_dia"
  | "radiance" | "tmax" | "k" | "kavg" | "d_tmax" | "d_ohm"
  | "dext_hf" | "dext_cf" | "errorbar_plus" | "errorbar_minus";

const Y_TESTS: Array<{ meaning: YMeaning; test: (n: string, raw: string) => boolean; unit: string }> = [
  { meaning: "errorbar_plus", test: (n) => /errorbar\+?$/.test(n) || /errorbarplus/.test(n), unit: "" },
  { meaning: "errorbar_minus", test: (n) => /errorbar\-?$/.test(n) || /errorbarminus/.test(n), unit: "" },
  {
    meaning: "d2_norm",
    test: (n) => /^\(?d\/d[o0]\)?2?$/.test(n) || /^\(?d\/d[o0]\)$/.test(n) || n === "ddo2" || /^\(d\/d[o0]\)2$/.test(n),
    unit: "-",
  },
  { meaning: "d2", test: (n) => /^d2$/.test(n) || /^d\^?2$/.test(n) || /^diameter2$/.test(n), unit: "mm²" },
  {
    meaning: "dflame_ratio",
    test: (n) => /dflame\/d[o0]drop/.test(n) || /dflamed[o0]drop/.test(n) || /flame\/drop/.test(n),
    unit: "-",
  },
  {
    meaning: "coolflame_dia",
    test: (n) => /coolflamedia/.test(n) || /coolflamediameter/.test(n) || /dia.*coolflame/.test(n),
    unit: "mm",
  },
  {
    meaning: "dflame",
    test: (n) => /^dflame/.test(n) || /^df$/.test(n) || /^dfmm/.test(n) || /^flamediameter$/.test(n) || /^diametrodllama/.test(n),
    unit: "mm",
  },
  {
    meaning: "diameter",
    test: (n) => /^diameter$/.test(n) || /^d$/.test(n) || /^ddrop$/.test(n) || /^dropletdiameter/.test(n) || /^diametermm/.test(n),
    unit: "mm",
  },
  { meaning: "tmax", test: (n) => /^tmax/.test(n) || /^maxtemp/.test(n) || /^peaktemp/.test(n), unit: "K" },
  { meaning: "d_tmax", test: (n) => /dtmax\/ddrop/.test(n) || /dtmaxddrop/.test(n), unit: "-" },
  { meaning: "d_ohm", test: (n) => /dohm\/ddrop/.test(n) || /dohmddrop/.test(n) || /^dohm/.test(n), unit: "-" },
  { meaning: "radiance", test: (n) => /radiance/.test(n) || /^q$/.test(n) || /^qw$/.test(n) || /^heatrelease/.test(n), unit: "W" },
  { meaning: "kavg", test: (n) => /kavg/.test(n) || /^kaverage/.test(n) || /^kb$/.test(n) || /^kbmm/.test(n), unit: "mm²/s" },
  { meaning: "k", test: (n) => /^k$/.test(n) || /^kmm/.test(n) || /^burningrate/.test(n), unit: "mm²/s" },
  { meaning: "dext_hf", test: (n) => /dext/.test(n) && /(hot|hf)/.test(n), unit: "mm" },
  { meaning: "dext_cf", test: (n) => /dext/.test(n) && /(cool|cf)/.test(n), unit: "mm" },
  { meaning: "dext_hf", test: (n) => /^dext$/.test(n) || /^dextmm/.test(n) || (/^dext/.test(n) && !/(cool|cf)/.test(n)), unit: "mm" },
];

function inferY(header: string): { meaning: YMeaning; unit: string; errSign?: 1 | -1 } | null {
  const { name, unit } = splitHeaderUnit(header);
  const n = normName(name);
  // barras de error: «Dext_CF_ErrorBar+» → significado base dext_cf + signo
  const eb = name.match(/errorbar\s*\+?\s*-?\s*$/i) ?? name.match(/error\s*bar\s*[+-]\s*$/i);
  let errSign: 1 | -1 | undefined;
  let baseName = name;
  if (eb) {
    errSign = /\+/.test(eb[0]) ? 1 : /-/.test(eb[0]) ? -1 : 1;
    baseName = name.slice(0, name.length - eb[0].length).replace(/[_\s-]+$/, "");
  }
  const nBase = normName(baseName);
  for (const def of Y_TESTS) {
    if (def.test(errSign !== undefined ? nBase : n, baseName)) {
      return { meaning: def.meaning, unit: unit || def.unit, errSign };
    }
  }
  return null;
}

/** Tabla métrica final según (significado Y, eje X). Debe coincidir con el
 *  catálogo METRIC_CATALOG del tab Análisis para que la superposición funcione. */
const METRIC_BY_MEANING_X: Record<YMeaning, Partial<Record<string, string>>> = {
  d2: { time_s: "d2" },
  d2_norm: { time_norm: "d2_norm", time_s: "d2_norm_t" },
  diameter: { time_s: "diameter" },
  dflame: { time_s: "dflame", time_norm: "dflame_tnorm" },
  dflame_ratio: { time_norm: "dflame_ratio" },
  coolflame_dia: { time_norm: "coolflame_dia", time_s: "coolflame_dia" },
  radiance: { time_s: "radiance", time_norm: "radiance_tnorm" },
  tmax: { time_s: "tmax" },
  k: { time_s: "k" },
  kavg: { pressure_atm: "kavg_p", time_s: "k" },
  d_tmax: { time_s: "d_tmax" },
  d_ohm: { time_s: "d_ohm" },
  dext_hf: { diameter_mm: "dext_hf_do", pressure_atm: "dext_hf_p" },
  dext_cf: { diameter_mm: "dext_cf_do", pressure_atm: "dext_cf_p" },
  errorbar_plus: {},
  errorbar_minus: {},
};

/** Palabras clave de origen (fuente de la serie). */
const SOURCE_PATTERNS: Array<{ re: RegExp; source: SeriesSource }> = [
  {
    re: /\b(expt|exps?|experiments?|experimentos?|flight|vuelos?|medici[oó]ns?|mediciones|measured?)\b/i,
    source: "EXPERIMENT",
  },
  { re: /\bsim(ulation|ulaci[oó]n)?s?\b/i, source: "SIMULATION" },
  { re: /\b(modelos?|models?|fit|ajustes?)\b/i, source: "MODEL" },
];

function inferSource(text: string): { source: SeriesSource; matched: string } {
  for (const { re, source } of SOURCE_PATTERNS) {
    const m = text.match(re);
    if (m) return { source, matched: m[0] };
  }
  return { source: "EXPERIMENT", matched: "" };
}

/* ------------------------------------------------------------------ */
/* División en bloques por columnas vacías                             */
/* ------------------------------------------------------------------ */

interface ColBlock {
  start: number;
  end: number; // inclusivo
}

export function splitColumnBlocks(rows: string[][]): ColBlock[] {
  const maxCols = Math.max(...rows.map((r) => r.length), 0);
  const emptyCol: boolean[] = [];
  for (let c = 0; c < maxCols; c++) {
    emptyCol[c] = rows.every((r) => {
      const cell = r[c] ?? "";
      return cell === "" || cell === null || cell === undefined;
    });
  }
  const blocks: ColBlock[] = [];
  let cur: ColBlock | null = null;
  for (let c = 0; c < maxCols; c++) {
    if (!emptyCol[c]) {
      if (cur === null) cur = { start: c, end: c };
      else cur.end = c;
    } else if (cur !== null) {
      blocks.push(cur);
      cur = null;
    }
  }
  if (cur !== null) blocks.push(cur);
  return blocks;
}

/* ------------------------------------------------------------------ */
/* Análisis de un bloque                                               */
/* ------------------------------------------------------------------ */

interface BlockSeriesDraft {
  metric: string;
  xKind: string;
  xUnit: string;
  yUnit: string;
  labelParts: string[];
  source: SeriesSource;
  sourceWord: string;
  points: number[][];
  meaning: YMeaning;
  /** nombre de la columna Y (para desambiguar etiquetas repetidas) */
  yQualifier: string;
  /** presente en columnas ErrorBar±: se fusionan en la serie base */
  errSign?: 1 | -1;
}

function blockCell(rows: string[][], r: number, c: number): string {
  return (rows[r] ?? [])[c] ?? "";
}

function analyzeBlock(
  rows: string[][],
  block: ColBlock,
  warnings: string[]
): BlockSeriesDraft[] {
  // 1. Fila de cabecera: primera fila del bloque con alguna celda no numérica.
  let headerRow = -1;
  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    let nonNumeric = 0;
    let nonEmpty = 0;
    for (let c = block.start; c <= block.end; c++) {
      const cell = blockCell(rows, r, c);
      if (cell !== "") {
        nonEmpty++;
        if (!isNumericCell(cell)) nonNumeric++;
      }
    }
    if (nonEmpty > 0 && nonNumeric >= 1) {
      headerRow = r;
      break;
    }
    if (nonEmpty > 0 && nonNumeric === 0) break; // bloque sin cabecera
  }
  if (headerRow === -1) {
    warnings.push(`Bloque sin cabecera (columnas ${block.start + 1}–${block.end + 1}): se omite.`);
    return [];
  }
  const headers: string[] = [];
  for (let c = block.start; c <= block.end; c++) {
    headers.push(blockCell(rows, headerRow, c));
  }
  const dataRows = rows.slice(headerRow + 1);

  // 2. Clasificar columnas: etiqueta (no numérica en cabecera ni eje) vs. eje.
  const labelCols: number[] = [];
  const dataCols: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const isX = inferX(h) !== null;
    const isY = inferY(h) !== null;
    if (h !== "" && !isX && !isY) {
      labelCols.push(i);
    } else if (h === "") {
      // sin cabecera: es etiqueta si sus datos son mayormente no numéricos
      let numeric = 0;
      let total = 0;
      for (const r of dataRows) {
        const cell = r[block.start + i] ?? "";
        if (cell !== "") {
          total++;
          if (isNumericCell(cell)) numeric++;
        }
      }
      if (total > 0 && numeric / total < 0.5) labelCols.push(i);
      else dataCols.push(i);
    } else {
      dataCols.push(i);
    }
  }

  // 3. Etiquetas del bloque: cabeceras de columnas de etiqueta + celdas no
  //    numéricas de las filas de datos (condiciones: 1 atm, do 4 mm, C7…).
  const labelStrings: string[] = [];
  const pushLabel = (s: string) => {
    const t = s.trim();
    if (t !== "" && !labelStrings.includes(t) && labelStrings.length < 10) {
      labelStrings.push(t);
    }
  };
  for (const li of labelCols) {
    if (headers[li] !== "") pushLabel(headers[li]);
  }
  // etiquetas dispersas en las filas de datos de las columnas de etiqueta
  const scanRows = Math.min(dataRows.length, 40);
  for (let r = 0; r < scanRows; r++) {
    for (const li of labelCols) {
      const cell = blockCell(dataRows, r, block.start + li);
      if (cell !== "" && !isNumericCell(cell)) pushLabel(cell);
    }
    // primera columna del bloque sin ser etiqueta: texto sobre el eje X
    if (!labelCols.includes(0) && r < 3) {
      const cell = blockCell(dataRows, r, block.start);
      if (cell !== "" && !isNumericCell(cell)) pushLabel(cell);
    }
  }

  const joinedLabels = labelStrings.join(" · ");
  const blockSource = inferSource(joinedLabels);

  // 4. Agrupar columnas de datos en series: cada X abre un grupo.
  const groups: Array<{ xIdx: number; yIdx: number[] }> = [];
  const orphanYCols: number[] = [];
  for (const di of dataCols) {
    const h = headers[di];
    if (inferX(h) !== null) {
      groups.push({ xIdx: di, yIdx: [] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].yIdx.push(di);
    } else {
      orphanYCols.push(di); // columna Y sin X previa dentro del bloque
    }
  }
  // columnas Y huérfanas sin ningún dato numérico son etiquetas del bloque
  // (p. ej. «Flame Radiance I» sobre un par t/Radiance)
  for (const oi of orphanYCols) {
    let numeric = 0;
    for (const r of dataRows) {
      const cell = r[block.start + oi] ?? "";
      if (cell !== "" && isNumericCell(cell)) numeric++;
    }
    if (numeric === 0 && headers[oi] !== "") pushLabel(headers[oi]);
  }

  // 5. Primera pasada: puntos por (grupo, columna Y). Una columna Y sin
  //    ningún dato numérico es en realidad una etiqueta (p. ej. «Flame
  //    Radiance I») y pasa a engrosar las etiquetas del bloque.
  interface YPass {
    g: { xIdx: number; yIdx: number[] };
    yi: number;
    yHeader: string;
    yDef: NonNullable<ReturnType<typeof inferY>>;
    points: number[][];
    numericCells: number;
  }
  const passes: YPass[] = [];
  for (const g of groups) {
    if (g.yIdx.length === 0) continue;
    const xDef = inferX(headers[g.xIdx]);
    if (!xDef) continue;
    for (const yi of g.yIdx) {
      const yHeader = headers[yi];
      const yDef = inferY(yHeader);
      if (!yDef) {
        warnings.push(
          `Columna «${yHeader}» sin métrica reconocida (bloque col. ${block.start + 1}): se omite.`
        );
        continue;
      }
      const points: number[][] = [];
      let numericCells = 0;
      for (const r of dataRows) {
        const ys = r[block.start + yi] ?? "";
        if (ys !== "" && isNumericCell(ys)) numericCells++;
        const xs = r[block.start + g.xIdx] ?? "";
        if (xs === "" || ys === "" || !isNumericCell(xs) || !isNumericCell(ys)) continue;
        points.push([Number(xs), Number(ys)]);
      }
      passes.push({ g, yi, yHeader, yDef, points, numericCells });
    }
  }
  // columnas Y sin datos numéricos → sus cabeceras son etiquetas del bloque
  for (const p of passes) {
    if (p.numericCells === 0 && p.yHeader !== "") pushLabel(p.yHeader);
  }

  // 6. Segunda pasada: construir series.
  const drafts: BlockSeriesDraft[] = [];
  for (const p of passes) {
    if (p.points.length === 0 || p.numericCells === 0) continue;
    p.points.sort((a, b) => a[0] - b[0]);
    const xDef = inferX(headers[p.g.xIdx])!;
    const meaning = p.yDef.meaning;
    const metric = METRIC_BY_MEANING_X[meaning][xDef.xKind] ?? `${meaning}_${xDef.xKind}`;

    // fuente: primero las etiquetas del bloque; si no dicen nada, la cabecera Y
    // (p. ej. «Dext_HF_model» → MODEL)
    let { source, matched } = blockSource;
    let qualifier = "";
    if (matched === "") {
      const fromHeader = inferSource(p.yHeader.replace(/[_\-]+/g, " "));
      if (fromHeader.matched !== "") {
        source = fromHeader.source;
        matched = fromHeader.matched;
        qualifier = p.yHeader.replace(new RegExp(fromHeader.matched, "i"), "").trim();
      }
    }
    if (qualifier === "") {
      const { name } = splitHeaderUnit(p.yHeader);
      qualifier = name;
    }

    // etiqueta: partes que no son la palabra de origen
    const labelParts = labelStrings.filter(
      (s) => s.toLowerCase() !== matched.toLowerCase()
    );

    drafts.push({
      metric,
      xKind: xDef.xKind,
      xUnit: xDef.unit,
      yUnit: p.yDef.unit,
      labelParts,
      source,
      sourceWord: matched,
      points: p.points,
      meaning,
      yQualifier: humanize(qualifier).replace(/\s+/g, " "),
      errSign: p.yDef.errSign,
    });
  }
  return drafts;
}

/* ------------------------------------------------------------------ */
/* Fusión de barras de error                                           */
/* ------------------------------------------------------------------ */

function mergeErrorBars(drafts: BlockSeriesDraft[], warnings: string[]): BlockSeriesDraft[] {
  const base = drafts.filter((d) => d.errSign === undefined);
  const errs = drafts.filter((d) => d.errSign !== undefined);
  if (errs.length === 0) return base;

  for (const e of errs) {
    // serie base: mismo significado de métrica, mismo eje X y valores x
    // coincidentes; se prefiere la experimental y una base sin errores aún.
    let target: BlockSeriesDraft | null = null;
    let targetScore = -1;
    for (const b of base) {
      if (b.meaning !== e.meaning || b.xKind !== e.xKind) continue;
      const bxs = new Set(b.points.map((p) => p[0]));
      if (!e.points.every((p) => bxs.has(p[0]))) continue;
      const hasErr = b.points.some((p) => p.length >= 4);
      const score = (b.source === "EXPERIMENT" ? 2 : 0) + (hasErr ? 0 : 1);
      if (score > targetScore) {
        target = b;
        targetScore = score;
      }
    }
    if (!target) {
      warnings.push(
        `Barras de error sin serie base coincidente («${e.labelParts.join(" ") || e.yQualifier}»): se omiten.`
      );
      continue;
    }
    // asegurar 4 componentes por punto
    for (const p of target.points) {
      while (p.length < 4) p.push(p[p.length - 1] ?? p[1]);
    }
    for (const ep of e.points) {
      const tp = target.points.find((p) => p[0] === ep[0]);
      if (!tp) continue;
      if (e.errSign === 1) tp[2] = ep[1];
      else tp[3] = ep[1];
    }
  }
  return base;
}

/* ------------------------------------------------------------------ */
/* Tablas experimentales («Experimental table», p. ej. ACME CFI-G)     */
/*                                                                     */
/* Formato distinto a los «Analyzed Data»: una única tabla donde cada   */
/* FILA es una prueba (test) y cada columna una condición o resultado  */
/* (presión, X_O2, caudal, T adiabática, tiempo de combustión…). No hay */
/* pares (x, y) por columnas, así que se convierte a series dispersas: */
/* un eje X experimental (presión, X_O2) + una columna Y + un grupo    */
/* por combustible.                                                    */
/* ------------------------------------------------------------------ */

export interface ImportHints {
  combustionType?: "SOLID_SURFACE" | "AEROSOL" | "LIQUID_DROPLET" | "GASEOUS";
  shortName?: string;
  name?: string;
}

/** Sugerencias de metadata a partir del nombre del archivo (p. ej. CFI-G →
 *  combustión gaseosa). Se usan como valores por defecto al crear la
 *  investigación, tanto en la UI como en el propio endpoint. */
export function importHints(fileName: string): ImportHints {
  const hints: ImportHints = {};
  // «CFI-G_…»: tras la G viene «_» y antes de CFI puede venir «_» (ambos
  // son caracteres de palabra, así que \b no sirve): límites explícitos
  const cfiG = /cfi[\s_-]*g(?![a-z0-9])/i;
  if (cfiG.test(fileName) || /gases|gaseous|premix|counterflow|jet flame/i.test(fileName)) {
    hints.combustionType = "GASEOUS";
  }
  if (cfiG.test(fileName)) {
    hints.shortName = "CFI-G";
    hints.name = "ACME — Cool Flames Investigation with Gases (CFI-G)";
  }
  return hints;
}

/** Ejes X experimentales admitidos en tablas. `suffix` se añade a la clave
 *  de métrica (burntime_p = burn time vs presión) para que solo se
 *  superpongan series con el mismo eje X y unidad Y. */
interface TableXDef {
  kind: string;
  suffix: string;
  unit: string;
  test: (n: string, unit: string) => boolean;
}

const TABLE_X_DEFS: TableXDef[] = [
  {
    kind: "pressure_bar",
    suffix: "p",
    unit: "bar",
    test: (n, u) => /approxp$|^p$|^pressure/.test(n) && (u === "" || u === "bar"),
  },
  {
    kind: "pressure_atm",
    suffix: "p",
    unit: "atm",
    test: (n, u) => /approxp$|^p$|^pressure/.test(n) && u === "atm",
  },
  { kind: "xo2", suffix: "o2", unit: "-", test: (n) => /^xo2$/.test(n) },
  { kind: "xo2", suffix: "o2", unit: "-", test: (n) => /^xo2beforetest$/.test(n) },
];

/** Columnas Y conocidas en tablas experimentales. `result: true` ⇒ es un
 *  resultado de la prueba: las filas sin ignición se omiten. */
interface TableYDef {
  base: string;
  re: RegExp;
  unit: string;
  result?: boolean;
}

const TABLE_Y_DEFS: TableYDef[] = [
  { base: "o2rate", re: /o2flowrate/, unit: "mg/s" },
  { base: "hcrate", re: /hcburnrate|^mhc|fuelburnrate/, unit: "mg/s" },
  { base: "peaktempk", re: /peakburnertemp$/, unit: "K", result: true },
  { base: "peaktemp", re: /peakburnertempc$|peakburnertc$|peakburner/, unit: "°C", result: true },
  { base: "burntime", re: /burntime/, unit: "s", result: true },
  { base: "tad", re: /tad/, unit: "K" },
  { base: "zst", re: /zst/, unit: "-" },
  { base: "xf_before", re: /xfbeforetest/, unit: "-" },
  { base: "xf_after", re: /xfaftertest/, unit: "-" },
  { base: "xf", re: /^xf$/, unit: "-" },
  { base: "xo2_after", re: /xo2aftertest/, unit: "-" },
];

/** Columnas que nunca son Y (identificadores y anotaciones). */
const TABLE_EXCLUDED =
  /^(flametype|flame|^day$|^days$|^fuel|fuels$|^test$|testid|testname|ignition|self.*ext|flowterm|^se$|^ft$|^color$|^colors$|comments?$|comment|^coolflame|^psi|notes?$)/;

/** Busca la fila de cabecera de una tabla: la primera con ≥5 celdas no
 *  vacías y ≥3 no numéricas. Devuelve -1 si no hay candidata. */
function findTableHeader(rows: string[][]): number {
  for (let r = 0; r < Math.min(rows.length, 8); r++) {
    const nonEmpty = rows[r].filter((c) => c !== "").length;
    const nonNumeric = rows[r].filter((c) => c !== "" && !isNumericCell(c)).length;
    if (nonEmpty >= 5 && nonNumeric >= 3) return r;
  }
  return -1;
}

/** ¿Es este archivo una tabla experimental (matriz de pruebas)? */
export function looksLikeExperimentalTable(rows: string[][], fileName: string): boolean {
  const headerRow = findTableHeader(rows);
  if (headerRow === -1) return false;
  const headers = rows[headerRow].map((h) => normName(splitHeaderUnit(h).name));
  const dataRows = rows.slice(headerRow + 1);

  let score = 0;
  if (/experimental\s*table/i.test(fileName)) score += 3;

  // columna «Test» con identificadores tipo «21196 A1» / «21088A1»
  const testIdx = headers.findIndex((h) => /^(test|testid|testname)$/.test(h));
  if (testIdx >= 0) {
    let ids = 0;
    let total = 0;
    for (const r of dataRows) {
      const v = (r ?? [])[testIdx] ?? "";
      if (v === "") continue;
      total++;
      if (/^\d{4,6}\s*[A-Za-z]/.test(v)) ids++;
    }
    if (total >= 3 && ids / total >= 0.6) score += 3;
  }
  if (headers.some((h) => /^fuel/.test(h))) score += 1;
  if (headers.some((h) => TABLE_X_DEFS.some((d) => d.test(h, "")))) score += 1;
  if (headers.some((h) => /flametype|coolflame|ignition/.test(h))) score += 1;

  // columnas numéricas de medición (excluyendo identificadores)
  let numericCols = 0;
  for (let c = 0; c < headers.length; c++) {
    const h = headers[c];
    if (h === "" || TABLE_EXCLUDED.test(h)) continue;
    let num = 0;
    let tot = 0;
    for (const r of dataRows) {
      const v = (r ?? [])[c] ?? "";
      if (v === "") continue;
      tot++;
      if (isNumericCell(v)) num++;
    }
    if (tot >= 3 && num / tot >= 0.5) numericCols++;
  }
  if (numericCols >= 4) score += 1;

  return score >= 4;
}

/** Convierte una tabla experimental en un dataset con series dispersas. */
function parseExperimentalTable(
  fileName: string,
  rows: string[][],
  naming: FileNaming,
  warnings: string[]
): ParsedDataset | null {
  const headerRow = findTableHeader(rows);
  if (headerRow === -1) return null;
  const headers = rows[headerRow];
  const cols = headers.map((h) => {
    const { name, unit } = splitHeaderUnit(h);
    return { name, unit, n: normName(name) };
  });
  // filas de datos: descartar filas vacías (los CSV de PSI traen cientos)
  const dataRows = rows
    .slice(headerRow + 1)
    .filter((r) => r.some((c) => c !== ""));

  const idxOf = (re: RegExp) => cols.findIndex((c) => c.n !== "" && re.test(c.n));
  const testIdx = idxOf(/^(test|testid|testname)$/);
  const fuelIdx = idxOf(/^fuel/);
  const flameTypeIdx = idxOf(/^(flametype|flame)$/);
  const ignitionIdx = idxOf(/ignition/);

  // ejes X presentes en la tabla
  const xCols: Array<{ idx: number; def: TableXDef }> = [];
  for (const def of TABLE_X_DEFS) {
    const idx = cols.findIndex((c) => c.n !== "" && def.test(c.n, c.unit));
    if (idx >= 0 && !xCols.some((x) => x.idx === idx)) xCols.push({ idx, def });
  }

  // columnas Y numéricas
  const yCols: Array<{ idx: number; def: TableYDef; header: string }> = [];
  for (let c = 0; c < cols.length; c++) {
    const h = cols[c].n;
    if (h === "" || c === testIdx || c === fuelIdx || c === flameTypeIdx || c === ignitionIdx) continue;
    if (TABLE_EXCLUDED.test(h)) continue;
    if (xCols.some((x) => x.idx === c)) continue;
    let num = 0;
    let tot = 0;
    for (const r of dataRows) {
      const v = r[c] ?? "";
      if (v === "") continue;
      tot++;
      if (isNumericCell(v)) num++;
    }
    if (tot < 3 || num / tot < 0.5) continue; // TFP (Sí/No), color, comentarios…
    const def = TABLE_Y_DEFS.find((d) => d.re.test(h));
    if (def) {
      yCols.push({ idx: c, def, header: headers[c] });
    } else {
      // columna numérica desconocida: métrica genérica con su propio nombre
      const base = slugify(cols[c].name).slice(0, 24).replace(/^_+|_+$/g, "");
      const safeBase = base || `col${c + 1}`;
      yCols.push({
        idx: c,
        def: { base: safeBase, re: /^.*$/, unit: cols[c].unit || "-" },
        header: headers[c],
      });
      warnings.push(
        `Columna «${headers[c]}» no reconocida: se importa con la métrica genérica «${safeBase}».`
      );
    }
  }

  if (xCols.length === 0) {
    warnings.push("No se encontró un eje X experimental (presión o X_O2): no se puede graficar la tabla.");
    return null;
  }
  if (yCols.length === 0) {
    warnings.push("No se encontraron columnas numéricas de medición en la tabla.");
    return null;
  }

  // grupos por combustible (o por tipo de llama si no hay combustible)
  const groupIdx = fuelIdx >= 0 ? fuelIdx : flameTypeIdx;
  const groups = new Map<string, number[]>();
  dataRows.forEach((r, i) => {
    const raw = groupIdx >= 0 ? (r[groupIdx] ?? "").trim() : "";
    if (groupIdx >= 0 && raw === "") return;
    const label = raw !== "" ? humanize(raw) : "Experiment";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(i);
  });
  if (groups.size === 0) {
    warnings.push("La tabla no tiene filas de pruebas con combustible.");
    return null;
  }

  // series: (eje X × columna Y × grupo)
  const series: Array<ParsedSeries & { sort: number }> = [];
  let skippedNoIgnition = 0;
  let sortIdx = 0;
  for (const xc of xCols) {
    for (const yc of yCols) {
      for (const [label, rowIdx] of groups) {
        const points: number[][] = [];
        for (const i of rowIdx) {
          const r = dataRows[i];
          const xs = r[xc.idx] ?? "";
          const ys = r[yc.idx] ?? "";
          if (xs === "" || ys === "" || !isNumericCell(xs) || !isNumericCell(ys)) continue;
          // los resultados de pruebas sin ignición («Hot ignition» = No) no
          // son mediciones: tiempo 0 y temperatura ambiente
          if (
            yc.def.result &&
            ignitionIdx >= 0 &&
            /^no$/i.test((r[ignitionIdx] ?? "").trim())
          ) {
            skippedNoIgnition++;
            continue;
          }
          points.push([Number(xs), Number(ys)]);
        }
        if (points.length === 0) continue;
        points.sort((a, b) => a[0] - b[0]);
        series.push({
          metric: `${yc.def.base}_${xc.def.suffix}`,
          xKind: xc.def.kind,
          xUnit: xc.def.unit,
          yUnit: yc.def.unit,
          label,
          source: "EXPERIMENT",
          points,
          sort: sortIdx++,
        });
      }
    }
  }
  if (series.length === 0) {
    warnings.push("Ninguna combinación (eje X, columna, combustible) produjo puntos.");
    return null;
  }
  if (skippedNoIgnition > 0) {
    warnings.push(
      `Se omitieron ${skippedNoIgnition} puntos de pruebas sin ignición (tiempo de combustión / T pico del quemador = 0).`
    );
  }

  const flameWord = (naming.rest.match(/inverse|normal|spherical|premixed|counterflow/i) ?? [])[0];
  const fuels =
    fuelIdx >= 0
      ? [...new Set(dataRows.map((r) => (r[fuelIdx] ?? "").trim()).filter(Boolean))]
      : [];

  // humanize abre «CFI-G» en «CFI G»: recuperar el guion entre siglas
  const datasetName = naming.datasetName.replace(/([A-Z])\s([A-Z])(?=\s|$)/g, "$1-$2");

  return {
    key: naming.key,
    nameEs: datasetName,
    nameEn: datasetName,
    tag: flameWord
      ? `Importado · ${humanize(flameWord)}`
      : "Importado · Experimental",
    fuel: fuels.join(", "),
    condition: `${flameWord ? `${humanize(flameWord)} · ` : ""}${dataRows.length} tests`,
    reference: `Archivo: ${fileName}`,
    series,
  };
}

/* ------------------------------------------------------------------ */
/* Nombres de dataset a partir del archivo                             */
/* ------------------------------------------------------------------ */

export function extractPsiCode(fileName: string): string | null {
  const m = fileName.match(/psi[\s_-]*(\d{1,4})/i);
  if (!m) return null;
  return `PSI-${m[1]}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function humanize(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FileNaming {
  psiCode: string | null;
  rest: string; // parte del nombre tras «PSI-xxx_Analyzed Data_» o el stem
  sourceTag: string; // MST 2024, PROCI 2019…
  datasetName: string;
  key: string;
}

function fileNaming(fileName: string, psiOverride?: string): FileNaming {
  const base = fileName.replace(/\.(csv|tsv|txt)$/i, "");
  const psiCode = psiOverride ?? extractPsiCode(base);
  let rest = base;
  const adIdx = rest.indexOf("Analyzed Data");
  const etIdx = rest.toLowerCase().indexOf("experimental table");
  if (adIdx >= 0) {
    rest = rest.slice(adIdx + "Analyzed Data".length).replace(/^[\s_-]+/, "");
  } else if (etIdx >= 0) {
    rest = rest.slice(etIdx + "experimental table".length).replace(/^[\s_-]+/, "");
  } else if (psiCode) {
    // quitar prefijo de código PSI si existe
    rest = rest.replace(new RegExp(`^${psiCode.replace("-", "[\\s_-]*")}`, "i"), "").replace(/^[\s_-]+/, "");
  }
  if (rest === "") rest = "datos";

  // etiqueta de fuente: siglas + año al principio (MST_2024_, PROCI_2019_…)
  const parts = rest.split(/[_\s]+/);
  let sourceTag = "";
  let nameStart = 0;
  if (parts.length >= 2 && /^[A-Z]{2,6}$/.test(parts[0]) && /^\d{4}$/.test(parts[1])) {
    sourceTag = `${parts[0]} ${parts[1]}`;
    nameStart = 2;
  } else if (parts.length >= 3 && /^[A-Z]{2,6}$/.test(parts[0]) && /^[A-Za-z0-9]{1,4}$/.test(parts[1]) && /^\d{4}$/.test(parts[2])) {
    // PROCI_C12_2019_…
    sourceTag = `${parts[0]} ${parts[1]} ${parts[2]}`;
    nameStart = 3;
  }
  const datasetName = humanize(parts.slice(nameStart).join(" ")) || "Datos analizados";
  const psiSlug = psiCode ? slugify(psiCode) : "sin_codigo";
  return {
    psiCode,
    rest,
    sourceTag,
    datasetName,
    key: `${psiSlug}_${slugify(rest) || "datos"}`,
  };
}

/* ------------------------------------------------------------------ */
/* Parser principal                                                    */
/* ------------------------------------------------------------------ */

export function parseAnalyzedCsv(
  fileName: string,
  text: string,
  psiOverride?: string
): ParsedFile {
  const warnings: string[] = [];
  const naming = fileNaming(fileName, psiOverride);
  const result: ParsedFile = {
    fileName,
    psiCode: naming.psiCode,
    dataset: null,
    warnings,
    hints: importHints(fileName),
  };

  let rows: string[][];
  try {
    rows = parseDelimited(text);
  } catch (e) {
    result.error = `No se pudo leer el archivo: ${String(e)}`;
    return result;
  }
  if (rows.length < 2) {
    result.error = "El archivo tiene menos de 2 filas con contenido.";
    return result;
  }

  // Las tablas experimentales (matrices de pruebas) tienen su propio
  // formato: cada fila es una prueba, no bloques (x, y) lado a lado.
  if (looksLikeExperimentalTable(rows, fileName)) {
    try {
      const dataset = parseExperimentalTable(fileName, rows, naming, warnings);
      if (dataset) {
        result.dataset = dataset;
        return result;
      }
    } catch (e) {
      warnings.push(`Error analizando la tabla experimental: ${String(e)}`);
    }
    result.error =
      "Se detectó una tabla experimental, pero no se pudo convertir a series (falta un eje X o columnas numéricas).";
    return result;
  }

  const blocks = splitColumnBlocks(rows);
  if (blocks.length === 0) {
    result.error = "No se detectaron bloques de datos.";
    return result;
  }

  const drafts: BlockSeriesDraft[] = [];
  for (const b of blocks) {
    try {
      drafts.push(...analyzeBlock(rows, b, warnings));
    } catch (e) {
      warnings.push(`Error analizando bloque (columnas ${b.start + 1}–${b.end + 1}): ${String(e)}`);
    }
  }

  const merged = mergeErrorBars(drafts, warnings);
  if (merged.length === 0) {
    result.error = "No se reconoció ninguna serie (x, y) en el archivo.";
    return result;
  }

  // etiquetas únicas: al colisionar se añade la palabra de origen y/o el
  // nombre de la columna Y antes de recurrir a un sufijo numérico
  const NOISE_RE = /\b(radiance|radiancia|diameter|di[aá]metro|diam|flame|llama|burning|t\s*max|temperat|error|cool)\b/gi;
  const usedLabels = new Set<string>();
  const series: ParsedSeries[] = merged.map((d, idx) => {
    let label = d.labelParts.filter(Boolean).join(" · ").trim();
    if (label === "") label = d.sourceWord || d.source;
    // limpiar ruido: palabras que repiten el significado de la métrica, pero
    // conservando el resto de la parte («Flame Diameter 5 atm» → «5 atm»)
    label = label
      .split(" · ")
      .map((part) =>
        part
          .replace(NOISE_RE, " ")
          .replace(/\(\s*\)|\(\s*,\s*\)/g, "")
          .replace(/[()]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(
        (part) =>
          part !== "" &&
          !/(^|\W)(sim(ulation)?s?|exps?|expts?|models?|modelos?|experiments?|experimentos?|medici[oó]n(es)?|measurements?)($|\W)/i.test(
            part
          )
      )
      .join(" · ")
      .trim();
    if (label === "") {
      label = d.sourceWord
        ? d.sourceWord.charAt(0).toUpperCase() + d.sourceWord.slice(1)
        : d.source;
    }
    if (usedLabels.has(label)) {
      const cands: string[] = [];
      if (
        d.sourceWord &&
        !label.toLowerCase().includes(d.sourceWord.toLowerCase())
      ) {
        cands.push(`${label} · ${d.sourceWord}`);
      }
      if (d.yQualifier) cands.push(`${label} · ${d.yQualifier}`);
      if (d.sourceWord && d.yQualifier) {
        cands.push(`${label} · ${d.sourceWord} · ${d.yQualifier}`);
      }
      const free = cands.find((c) => !usedLabels.has(c));
      if (free) label = free;
    }
    if (usedLabels.has(label)) {
      let n = 2;
      while (usedLabels.has(`${label} · ${n}`)) n++;
      label = `${label} · ${n}`;
    }
    usedLabels.add(label);
    return {
      metric: d.metric,
      xKind: d.xKind,
      xUnit: d.xUnit,
      yUnit: d.yUnit,
      label,
      source: d.source,
      points: d.points,
      sort: idx,
    } as ParsedSeries & { sort: number };
  });

  // condición: etiquetas distintivas (presiones, diámetros, combustibles)
  const conditionParts: string[] = [];
  for (const s of merged) {
    for (const part of s.labelParts) {
      const low = part.toLowerCase();
      if (/(radiance|diameter|diam|flame|t\s*max|burning|error|sim|model|expt)/.test(low)) continue;
      if (/(atm|mm\b|kpa|bar|c[0-9]{1,2}\b|heptan|dodecan|decan|octan|metan|etan|propan|butan|nox|o2|aire|ox[ií]g)/.test(low)) {
        if (!conditionParts.includes(part) && conditionParts.length < 6) {
          conditionParts.push(part);
        }
      }
    }
  }

  const tag = naming.sourceTag
    ? `Importado · ${naming.sourceTag}`
    : "Importado";

  result.dataset = {
    key: naming.key,
    nameEs: naming.datasetName,
    nameEn: naming.datasetName,
    tag,
    fuel: "",
    condition: conditionParts.join(" · "),
    reference: `Archivo: ${fileName}`,
    series,
  };
  return result;
}
