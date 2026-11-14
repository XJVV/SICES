import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseAnalyzedCsv } from "@/lib/import-parser";

/**
 * POST /api/import — importar archivos de datos del repositorio NASA PSI
 * y convertirlos en conjuntos de datos analizados. Soporta dos formatos:
 *
 *   - «Analyzed Data» (CSV/TSV): bloques de series (x, y) de publicaciones.
 *   - «Experimental table» (p. ej. ACME CFI-G): matriz de pruebas donde
 *     cada fila es un test; se convierte en series dispersas por
 *     combustible (eje X: presión / X_O2).
 *
 * multipart/form-data:
 *   files — uno o más archivos CSV
 *   meta  — JSON con metadatos de investigaciones nuevas:
 *           { "PSI-159": { shortName, name, category, combustionType, ... } }
 *   psi   — (opcional) código PSI para archivos sin código en el nombre
 *   dry   — "1" para analizar sin escribir en la base de datos
 *
 * Los archivos se parsean en bloques (los CSV de PSI traen varias tablas
 * lado a lado); cada archivo genera un dataset con sus series (x, y).
 * Si el dataset ya existe (misma clave) se omite — la importación es
 * idempotente.
 */

const metaSchema = z.object({
  shortName: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  category: z.enum(["PRINCIPAL", "COMPLEMENTARIA"]).optional(),
  combustionType: z
    .enum(["SOLID_SURFACE", "AEROSOL", "LIQUID_DROPLET", "GASEOUS"])
    .optional(),
  investigator: z.string().trim().optional(),
  platform: z.string().trim().optional(),
});

interface SeriesReport {
  metric: string;
  label: string;
  source: string;
  points: number;
}

interface DatasetReport {
  key: string;
  name: string;
  tag: string;
  seriesCount: number;
  pointsTotal: number;
  skipped: boolean; // ya existía
  created: boolean;
  series: SeriesReport[];
}

interface FileReport {
  fileName: string;
  psiCode: string | null;
  ok: boolean;
  error?: string;
  investigationId?: number;
  investigationCreated: boolean;
  dataset?: DatasetReport;
  warnings: string[];
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo." },
        { status: 400 }
      );
    }

    const dry = form.get("dry") === "1";
    const psiOverride = (form.get("psi") as string | null)?.trim() || undefined;

    let meta: Record<string, z.infer<typeof metaSchema>> = {};
    const metaRaw = form.get("meta");
    if (typeof metaRaw === "string" && metaRaw.trim() !== "") {
      try {
        const parsed = JSON.parse(metaRaw) as unknown;
        const asRecord = (parsed ?? {}) as Record<string, unknown>;
        for (const [code, value] of Object.entries(asRecord)) {
          const safe = metaSchema.safeParse(value);
          if (safe.success) meta[code.toUpperCase()] = safe.data;
        }
      } catch {
        return NextResponse.json(
          { error: "El campo «meta» no es JSON válido." },
          { status: 400 }
        );
      }
    }

    const results: FileReport[] = [];
    const createdDatasetKeys: string[] = [];
    const createdInvestigationIds: number[] = [];

    for (const file of files) {
      const name = file.name || "archivo.csv";
      const report: FileReport = {
        fileName: name,
        psiCode: null,
        ok: false,
        investigationCreated: false,
        warnings: [],
      };
      results.push(report);

      try {
        if (!/\.(csv|tsv|txt)$/i.test(name)) {
          report.error =
            "Formato no soportado: usa CSV, TSV o TXT (los «Analyzed Data» de PSI son CSV).";
          continue;
        }
        const text = await file.text();
        const parsed = parseAnalyzedCsv(name, text, psiOverride);
        report.psiCode = parsed.psiCode;
        report.warnings = parsed.warnings;

        if (parsed.error || !parsed.dataset) {
          report.error = parsed.error ?? "No se reconoció ninguna serie en el archivo.";
          continue;
        }
        if (!parsed.psiCode) {
          report.error =
            "El nombre del archivo no contiene un código PSI (p. ej. «PSI-159_...»). Indícalo en el campo de código.";
          continue;
        }

        const dataset = parsed.dataset;
        const pointsTotal = dataset.series.reduce((a, s) => a + s.points.length, 0);

        // investigación: existe o se crea
        let investigation = await db.investigation.findUnique({
          where: { psiCode: parsed.psiCode },
        });
        if (!investigation) {
          const m = meta[parsed.psiCode] ?? {};
          const h = parsed.hints ?? {};
          if (dry) {
            report.investigationCreated = true;
          } else {
            investigation = await db.investigation.create({
              data: {
                psiCode: parsed.psiCode,
                shortName: m.shortName || h.shortName || parsed.psiCode,
                name: m.name || h.name || `${parsed.psiCode} — ${dataset.nameEs}`,
                category: m.category ?? "COMPLEMENTARIA",
                combustionType: m.combustionType ?? h.combustionType ?? "LIQUID_DROPLET",
                investigator: m.investigator ?? "",
                platform: m.platform ?? "",
                fuel: dataset.fuel || "",
                description:
                  "Investigación creada automáticamente al importar datos (series analizadas o tablas experimentales). Edita su ficha para completar la metadata.",
                dataAvailable: `Importado desde ${name}`,
                filesCount: 1,
              },
            });
            createdInvestigationIds.push(investigation.id);
            report.investigationCreated = true;
          }
        }
        if (investigation) report.investigationId = investigation.id;

        // dataset: idempotente por clave
        const existing = await db.dataset.findUnique({ where: { key: dataset.key } });
        if (existing) {
          report.ok = true;
          report.dataset = {
            key: dataset.key,
            name: dataset.nameEs,
            tag: dataset.tag,
            seriesCount: 0,
            pointsTotal: 0,
            skipped: true,
            created: false,
            series: [],
          };
          continue;
        }

        const seriesReport: SeriesReport[] = dataset.series.map((s) => ({
          metric: s.metric,
          label: s.label,
          source: s.source,
          points: s.points.length,
        }));

        if (dry) {
          report.ok = true;
          report.dataset = {
            key: dataset.key,
            name: dataset.nameEs,
            tag: dataset.tag,
            seriesCount: dataset.series.length,
            pointsTotal,
            skipped: false,
            created: false,
            series: seriesReport,
          };
          continue;
        }

        await db.dataset.create({
          data: {
            key: dataset.key,
            investigationId: investigation!.id,
            nameEs: dataset.nameEs,
            nameEn: dataset.nameEn,
            tag: dataset.tag,
            fuel: dataset.fuel,
            condition: dataset.condition,
            reference: dataset.reference,
            series: {
              create: dataset.series.map((s) => ({
                metric: s.metric,
                xKind: s.xKind,
                xUnit: s.xUnit,
                yUnit: s.yUnit,
                label: s.label,
                source: s.source,
                pointsJson: JSON.stringify(s.points),
              })),
            },
          },
        });
        createdDatasetKeys.push(dataset.key);
        report.ok = true;
        report.dataset = {
          key: dataset.key,
          name: dataset.nameEs,
          tag: dataset.tag,
          seriesCount: dataset.series.length,
          pointsTotal,
          skipped: false,
          created: true,
          series: seriesReport,
        };
      } catch (e) {
        report.error = `Error al importar: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    return NextResponse.json({
      results,
      dry,
      createdDatasetKeys,
      summary: {
        files: results.length,
        ok: results.filter((r) => r.ok).length,
        // en modo dry se cuentan los que se crearían (no omitidos)
        datasetsCreated: results.filter((r) => r.dataset && !r.dataset.skipped).length,
        datasetsSkipped: results.filter((r) => r.dataset?.skipped).length,
        investigationsCreated: dry
          ? results.filter((r) => r.investigationCreated).length
          : createdInvestigationIds.length,
        seriesCreated: results.reduce(
          (a, r) => a + (r.dataset && !r.dataset.skipped ? r.dataset.seriesCount : 0),
          0
        ),
        pointsCreated: results.reduce(
          (a, r) => a + (r.dataset && !r.dataset.skipped ? r.dataset.pointsTotal : 0),
          0
        ),
      },
    });
  } catch (error) {
    console.error("POST /api/import", error);
    return NextResponse.json(
      { error: "Error al procesar la importación." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/import — deshacer una importación.
 * body: { datasetKeys?: string[], investigationIds?: number[] }
 * Elimina los datasets indicados. Las investigaciones de investigationIds
 * (las creadas automáticamente por la importación) se eliminan solo si han
 * quedado completamente vacías; el resto no se toca jamás.
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      datasetKeys?: number[] | string[];
      investigationIds?: number[];
    };
    const keys = (Array.isArray(body.datasetKeys) ? body.datasetKeys : []).map(
      String
    );
    const invIds = new Set(
      (Array.isArray(body.investigationIds) ? body.investigationIds : []).map(
        Number
      )
    );
    if (keys.length === 0 && invIds.size === 0) {
      return NextResponse.json(
        { error: "Indica los datasets a eliminar (datasetKeys)." },
        { status: 400 }
      );
    }

    let deletedDatasets = 0;
    let deletedSeries = 0;
    for (const key of keys) {
      const ds = await db.dataset.findUnique({
        where: { key },
        include: { _count: { select: { series: true } } },
      });
      if (!ds) continue;
      deletedSeries += ds._count.series;
      await db.dataset.delete({ where: { key } });
      deletedDatasets++;
    }

    // limpiar únicamente investigaciones creadas por la importación (vía
    // investigationIds) que hayan quedado vacías
    const removedInv: string[] = [];
    for (const id of invIds) {
      if (!Number.isFinite(id)) continue;
      const inv = await db.investigation.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              datasets: true,
              measurements: true,
              variables: true,
              publications: true,
              fuels: true,
            },
          },
        },
      });
      if (!inv) continue;
      const empty =
        inv._count.datasets === 0 &&
        inv._count.measurements === 0 &&
        inv._count.variables === 0 &&
        inv._count.publications === 0 &&
        inv._count.fuels === 0;
      if (empty) {
        removedInv.push(inv.psiCode);
        await db.investigation.delete({ where: { id } });
      }
    }

    return NextResponse.json({
      deletedDatasets,
      deletedSeries,
      removedInvestigations: removedInv,
    });
  } catch (error) {
    console.error("DELETE /api/import", error);
    return NextResponse.json(
      { error: "Error al deshacer la importación." },
      { status: 500 }
    );
  }
}
