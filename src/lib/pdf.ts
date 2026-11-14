/**
 * Generador de PDF minimalista sin dependencias (equivalente al
 * services/reportes.py del proyecto Flask). Fuentes estándar Helvetica con
 * WinAnsiEncoding (soporta acentos españoles). Páginas A4 apaisadas.
 */

const PAGE_W = 842; // A4 landscape
const PAGE_H = 595;
const MARGIN = 36;

// Mapa de puntuación Unicode → bytes WinAnsi (cp1252)
const WIN_ANSI_MAP: Record<string, string> = {
  "\u2014": "\u0097", // — em dash
  "\u2013": "\u0096", // – en dash
  "\u201C": "\u0093", // “
  "\u201D": "\u0094", // ”
  "\u2018": "\u0091", // ‘
  "\u2019": "\u0092", // ’
  "\u2026": "\u0085", // …
  "\u2264": "<=", // ≤
  "\u2265": ">=", // ≥
  "\u00B7": "\u00B7", // · (ya en latin1)
};

const WIN_ANSI_DROP = /[\u0100-\uFFFF]/g; // caracteres fuera de WinAnsi

function toWinAnsi(s: string): string {
  let out = "";
  for (const ch of s) {
    if (WIN_ANSI_MAP[ch] !== undefined) out += WIN_ANSI_MAP[ch];
    else out += ch;
  }
  return out.replace(WIN_ANSI_DROP, "?");
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export interface PdfTableCol {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

interface TextOp {
  x: number;
  y: number;
  size: number;
  font: "F1" | "F2" | "F3";
  text: string;
  color?: [number, number, number];
}

class Page {
  ops: string[] = [];
  constructor() {
    // fondo blanco
    this.ops.push("1 1 1 rg 0 0 " + PAGE_W + " " + PAGE_H + " re f");
  }
}

export class PdfBuilder {
  private pages: Page[] = [new Page()];
  private y = PAGE_H - MARGIN;

  get pageHeight(): number {
    return PAGE_H;
  }
  get margin(): number {
    return MARGIN;
  }
  get pageWidth(): number {
    return PAGE_W;
  }

  newPage(): void {
    this.pages.push(new Page());
    this.y = PAGE_H - MARGIN;
  }

  get spaceLeft(): number {
    return this.y - MARGIN;
  }

  moveDown(h: number): void {
    this.y -= h;
  }

  rect(x: number, y: number, w: number, h: number, color: [number, number, number]): void {
    const [r, g, b] = color;
    this.pages[this.pages.length - 1].ops.push(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, color: [number, number, number], width = 0.7): void {
    const [r, g, b] = color;
    this.pages[this.pages.length - 1].ops.push(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`
    );
  }

  text(t: TextOp): void {
    const { x, y, size, font } = t;
    const color = t.color ?? [0.1, 0.12, 0.15];
    const safe = esc(toWinAnsi(t.text));
    this.pages[this.pages.length - 1].ops.push(
      `BT ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${safe}) Tj ET`
    );
  }

  /** Texto con ajuste de línea simple (por palabras). Devuelve alto usado. */
  paragraph(t: {
    x: number;
    y: number;
    width: number;
    size: number;
    text: string;
    font?: "F1" | "F2" | "F3";
    color?: [number, number, number];
    lineHeight?: number;
    maxLines?: number;
  }): number {
    const font = t.font ?? "F1";
    const lh = t.lineHeight ?? t.size * 1.35;
    const charW = t.size * (font === "F2" ? 0.58 : 0.5);
    const maxChars = Math.max(8, Math.floor(t.width / charW));
    const words = toWinAnsi(t.text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const candidate = cur ? cur + " " + w : w;
      if (candidate.length > maxChars && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = candidate;
      }
    }
    if (cur) lines.push(cur);
    const maxLines = t.maxLines ?? 20;
    const shown = lines.slice(0, maxLines);
    if (lines.length > maxLines && shown.length > 0) {
      shown[shown.length - 1] = shown[shown.length - 1].slice(0, Math.max(0, shown[shown.length - 1].length - 3)) + "...";
    }
    let yy = t.y;
    for (const line of shown) {
      this.text({ x: t.x, y: yy, size: t.size, font, text: line, color: t.color });
      yy -= lh;
    }
    return shown.length * lh;
  }

  /** Tabla con cabecera, filas cebra y salto de página automático. */
  table(opts: {
    cols: PdfTableCol[];
    rows: string[][];
    headerBg?: [number, number, number];
    zebra?: [number, number, number];
    rowHeight?: number;
    fontSize?: number;
    renderCell?: (ctx: { page: number; row: number }) => void;
  }): void {
    const headerBg = opts.headerBg ?? [0.02, 0.23, 0.27];
    const zebra = opts.zebra ?? [0.93, 0.96, 0.97];
    const rowH = opts.rowHeight ?? 16;
    const fontSize = opts.fontSize ?? 7.5;
    const headerH = 20;
    const totalW = opts.cols.reduce((s, c) => s + c.width, 0);
    const x0 = (PAGE_W - totalW) / 2;

    const drawHeader = () => {
      this.rect(x0, this.y - headerH, totalW, headerH, headerBg);
      let x = x0;
      for (const c of opts.cols) {
        const tx =
          c.align === "right" ? x + c.width - 5 : c.align === "center" ? x + c.width / 2 - (c.header.length * fontSize * 0.31) : x + 5;
        this.text({ x: tx, y: this.y - headerH + 6.5, size: fontSize, font: "F2", text: c.header, color: [1, 1, 1] });
        x += c.width;
      }
      this.moveDown(headerH);
    };

    drawHeader();

    opts.rows.forEach((row, i) => {
      if (this.spaceLeft < rowH + 14) {
        this.newPage();
        drawHeader();
      }
      if (i % 2 === 1) {
        this.rect(x0, this.y - rowH, totalW, rowH, zebra);
      }
      let x = x0;
      row.forEach((cell, j) => {
        const col = opts.cols[j];
        const raw = toWinAnsi(String(cell ?? ""));
        const maxChars = Math.max(3, Math.floor((col.width - 8) / (fontSize * 0.52)));
        const display = raw.length > maxChars ? raw.slice(0, maxChars - 2) + ".." : raw;
        const tx =
          col.align === "right"
            ? x + col.width - 5 - display.length * fontSize * 0.5
            : col.align === "center"
              ? x + col.width / 2 - (display.length * fontSize * 0.5) / 2
              : x + 5;
        this.text({ x: tx, y: this.y - rowH + 5, size: fontSize, font: "F1", text: display, color: [0.13, 0.15, 0.18] });
        x += col.width;
      });
      this.moveDown(rowH);
      this.line(x0, this.y, x0 + totalW, this.y, [0.85, 0.88, 0.9], 0.4);
    });
  }

  /** Serializa el PDF completo a Buffer. */
  build(meta: { title: string; author: string }): Buffer {
    const objects: string[] = [];
    const nPages = this.pages.length;
    // 1: Catalog, 2: Pages, 3: F1, 4: F2, 5: F3, luego páginas/contenidos, y al final Info
    const firstPageObj = 6;
    const pageObjIds: number[] = [];
    const contentObjIds: number[] = [];
    for (let i = 0; i < nPages; i++) {
      pageObjIds.push(firstPageObj + i * 2);
      contentObjIds.push(firstPageObj + i * 2 + 1);
    }

    objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
    objects.push(
      `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${nPages} >>`
    );
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>`);

    this.pages.forEach((p, i) => {
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentObjIds[i]} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> >>`
      );
      const stream = p.ops.join("\n");
      objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    });

    const infoId = firstPageObj + nPages * 2;
    objects.push(
      `<< /Title (${esc(toWinAnsi(meta.title))}) /Author (${esc(toWinAnsi(meta.author))}) /Producer (SICES) /Creator (SICES PdfBuilder) >>`
    );

    const chunks: Buffer[] = [];
    let offset = 0;
    const push = (s: string) => {
      const b = Buffer.from(s, "latin1");
      chunks.push(b);
      offset += b.length;
    };

    push("%PDF-1.4\n");
    const offsets: number[] = [];
    objects.forEach((body, idx) => {
      offsets.push(offset);
      push(`${idx + 1} 0 obj\n${body}\nendobj\n`);
    });

    const xrefStart = offset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
      xref += `${String(off).padStart(10, "0")} 00000 n \n`;
    }
    push(xref);
    push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

    return Buffer.concat(chunks);
  }
}
