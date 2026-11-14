/** Herramientas deterministas de SOLO LECTURA. Los datos importados son entrada no confiable. */
import { z } from "zod";
import { db } from "@/lib/db";
import { buildWhere, parseFilters } from "@/lib/filters";
import { analyzedPoints, summarizePoints } from "@/lib/assistant/statistics";

const intId = z.number().int().positive();
const safeText = (v: string, length = 220) => v.slice(0, length);

export const TOOL_DEFINITIONS = [
  {
    name: "list_investigations",
    description: "Lista investigaciones PSI de SICES con tipo de combustión, código, nombre y cantidad de conjuntos de datos.",
    input_schema: {
      type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 40, description: "Máximo de investigaciones (predeterminado 30)" } },
      additionalProperties: false,
    },
  },
  {
    name: "summarize_series",
    description: "Calcula estadísticas verificables de una serie de análisis: rango, mínimo, máximo, primera y última medición, pendiente por regresión y muestra reducida. Usa el ID de serie.",
    input_schema: {
      type: "object", properties: { seriesId: { type: "integer", minimum: 1 } }, required: ["seriesId"], additionalProperties: false,
    },
  },
  {
    name: "compare_series",
    description: "Compara dos series por sus estadísticas y comprueba compatibilidad física de métrica, unidades y eje X; no mezcla unidades incompatibles.",
    input_schema: {
      type: "object", properties: { seriesIds: { type: "array", items: { type: "integer", minimum: 1 }, minItems: 2, maxItems: 2 } }, required: ["seriesIds"], additionalProperties: false,
    },
  },
  {
    name: "query_measurements",
    description: "Consulta mediciones de telemetría mediante filtros (O2 inicial, presión, temperatura, combustible, experimento y fechas). Devuelve agregados SQL, sin modificar datos.",
    input_schema: {
      type: "object",
      properties: {
        experiment: { type: "string", description: "Nombre corto exacto de la investigación" },
        fuel: { type: "string" },
        oxygenMin: { type: "number" }, oxygenMax: { type: "number" },
        pressureMin: { type: "number" }, pressureMax: { type: "number" },
        temperatureMin: { type: "number" }, temperatureMax: { type: "number" },
        dateFrom: { type: "string", description: "AAAA-MM-DD" }, dateTo: { type: "string", description: "AAAA-MM-DD" },
      }, additionalProperties: false,
    },
  },
] as const;

type SeriesRecord = Awaited<ReturnType<typeof findSeries>>;
async function findSeries(id: number) {
  return db.dataSeries.findUnique({
    where: { id },
    include: { dataset: { select: {
      id: true, key: true, tag: true, fuel: true, condition: true,
      reference: true, doi: true, investigationId: true,
      investigation: { select: { psiCode: true, shortName: true, name: true } },
    } } },
  });
}
function toSummary(s: NonNullable<SeriesRecord>) {
  return {
    seriesId: s.id, label: safeText(s.label), source: s.source,
    metric: s.metric, xKind: s.xKind, xUnit: s.xUnit, yUnit: s.yUnit,
    dataset: {
      id: s.dataset.id, key: s.dataset.key, tag: safeText(s.dataset.tag),
      fuel: safeText(s.dataset.fuel), condition: safeText(s.dataset.condition),
      reference: safeText(s.dataset.reference, 350), doi: safeText(s.dataset.doi),
    },
    investigation: s.dataset.investigation,
    statistics: summarizePoints(analyzedPoints(s.pointsJson)),
  };
}

async function listInvestigations(limit: number) {
  const items = await db.investigation.findMany({
    orderBy: { psiCode: "asc" }, take: limit,
    select: { id: true, psiCode: true, shortName: true, name: true, combustionType: true, category: true, _count: { select: { datasets: true, measurements: true } } },
  });
  return { investigations: items, returned: items.length };
}

async function compareSeries(ids: [number, number]) {
  const [a,b] = await Promise.all(ids.map(findSeries));
  if (!a || !b) return { error: "No existe una de las series solicitadas." };
  const comparable = a.metric === b.metric && a.xKind === b.xKind && a.xUnit === b.xUnit && a.yUnit === b.yUnit;
  const as = toSummary(a), bs = toSummary(b);
  return {
    comparable, reason: comparable ? "Misma métrica, eje X y unidades." : "Las métricas, los ejes X o las unidades difieren: no hagas comparaciones numéricas directas.",
    series: [as, bs],
    // La regresión es descriptiva; una tasa de combustión K física requiere validar modelo y unidades.
    note: "La pendiente lineal es descriptiva, no equivale necesariamente a la tasa de combustión K. No se interpolan series con tiempos experimentales distintos.",
  };
}

const querySchema = z.object({
  experiment: z.string().max(80).optional(), fuel: z.string().max(80).optional(),
  oxygenMin: z.number().finite().optional(), oxygenMax: z.number().finite().optional(),
  pressureMin: z.number().finite().optional(), pressureMax: z.number().finite().optional(),
  temperatureMin: z.number().finite().optional(), temperatureMax: z.number().finite().optional(),
  dateFrom: z.string().max(10).optional(), dateTo: z.string().max(10).optional(),
}).strict();

async function queryMeasurements(raw: unknown) {
  const input = querySchema.parse(raw);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value !== undefined) params.set(key, String(value));
  const { filters, errors } = parseFilters(params);
  if (errors.length) return { error: errors.join(" ") };
  const where = buildWhere(filters);
  const [aggregates, groups] = await Promise.all([
    db.measurement.aggregate({ where,
      _count: { id: true },
      _min: { o2Initial: true, pressure: true, temperature: true, propagationSpeed: true },
      _max: { o2Initial: true, pressure: true, temperature: true, propagationSpeed: true },
      _avg: { o2Initial: true, o2Final: true, pressure: true, temperature: true, flow: true, propagationSpeed: true, radiation: true },
    }),
    db.measurement.groupBy({ by: ["investigationId"], where, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 15 }),
  ]);
  const invs = await db.investigation.findMany({ where: { id: { in: groups.map((g) => g.investigationId) } }, select: { id: true, psiCode: true, shortName: true } });
  return { appliedFilters: filters, total: aggregates._count.id, min: aggregates._min, max: aggregates._max, avg: aggregates._avg,
    byInvestigation: groups.map((g) => ({ ...invs.find((i) => i.id === g.investigationId), count: g._count.id })),
    note: "Los promedios omiten valores nulos; no representan causalidad. Oxígeno inicial se expresa como fracción (0.21 = 21%).",
  };
}

/** Las entradas de herramientas nunca se ejecutan como instrucciones/código o SQL libre. */
export async function executeReadOnlyTool(name: string, raw: unknown) {
  try {
    switch (name) {
      case "list_investigations": {
        const { limit } = z.object({ limit: z.number().int().min(1).max(40).optional() }).strict().parse(raw);
        return await listInvestigations(limit ?? 30);
      }
      case "summarize_series": {
        const { seriesId } = z.object({ seriesId: intId }).strict().parse(raw);
        const row = await findSeries(seriesId);
        return row ? toSummary(row) : { error: "No existe esa serie." };
      }
      case "compare_series": {
        const { seriesIds } = z.object({ seriesIds: z.tuple([intId, intId]) }).strict().parse(raw);
        return await compareSeries(seriesIds);
      }
      case "query_measurements": return await queryMeasurements(raw);
      default: return { error: "Herramienta no permitida." };
    }
  } catch (err) {
    if (err instanceof z.ZodError) return { error: "Argumentos inválidos para la herramienta." };
    return { error: "No se pudo consultar la base de datos." };
  }
}

export async function buildSelectionContext(input: { investigationId: number | null; metric: string | null; seriesIds: number[] }) {
  if (!input.investigationId || !input.metric || !input.seriesIds.length) return { selected: [], message: "No hay series visibles seleccionadas." };
  const series = await db.dataSeries.findMany({
    where: { id: { in: input.seriesIds }, metric: input.metric, dataset: { investigationId: input.investigationId } },
    include: { dataset: { select: {
      id: true, key: true, tag: true, fuel: true, condition: true, reference: true, doi: true, investigationId: true,
      investigation: { select: { psiCode: true, shortName: true, name: true } },
    } } },
    take: 8,
  });
  return { selected: series.map(toSummary), message: `${series.length} series verificadas en el servidor; estadísticas de datos originales, no de la visualización normalizada.` };
}
