/**
 * Filtros de telemetría (portados del servicio Flask services/filtros.py):
 * rangos numéricos de O2/presión/temperatura, fechas, texto de experimento
 * y combustible. Compartido por /api/measurements y /api/export/*.
 */
import { Prisma } from "@prisma/client";

export interface MeasurementFilters {
  experiment?: string; // shortName de la investigación
  fuel?: string;
  hardware?: string;
  gravity?: string;
  oxygenMin?: number; // fracción (acepta % > 1 y normaliza)
  oxygenMax?: number;
  pressureMin?: number;
  pressureMax?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  dateFrom?: string; // ISO
  dateTo?: string;
}

function toNum(v: string | null): number | undefined {
  if (!v || !v.trim()) return undefined;
  const x = parseFloat(v.replace(",", "."));
  return Number.isNaN(x) ? undefined : x;
}

/** Extrae y valida los filtros de los query params. Devuelve (filtros, errores). */
export function parseFilters(params: URLSearchParams): { filters: MeasurementFilters; errors: string[] } {
  const filters: MeasurementFilters = {};
  const errors: string[] = [];

  const experiment = (params.get("experiment") || "").trim();
  if (experiment) filters.experiment = experiment;
  const fuel = (params.get("fuel") || "").trim();
  if (fuel) filters.fuel = fuel;
  for (const key of ["hardware", "gravity"] as const) {
    const v = (params.get(key) || "").trim().slice(0, 100);
    if (v) filters[key] = v;
  }

  for (const key of ["oxygenMin", "oxygenMax", "pressureMin", "pressureMax", "temperatureMin", "temperatureMax"] as const) {
    const v = toNum(params.get(key));
    if (v !== undefined) {
      if (key.startsWith("oxygen") && v > 1) {
        filters[key] = v / 100; // acepta % y normaliza a fracción
      } else {
        filters[key] = v;
      }
    }
  }

  for (const base of ["oxygen", "pressure", "temperature"] as const) {
    const a = filters[`${base}Min` as keyof MeasurementFilters] as number | undefined;
    const b = filters[`${base}Max` as keyof MeasurementFilters] as number | undefined;
    if (a !== undefined && b !== undefined && a > b) {
      errors.push(`'${base}Min' no puede ser mayor que '${base}Max'.`);
    }
  }

  const dateFrom = (params.get("dateFrom") || "").trim();
  if (dateFrom) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) errors.push("'dateFrom' debe tener formato AAAA-MM-DD.");
    else filters.dateFrom = dateFrom;
  }
  const dateTo = (params.get("dateTo") || "").trim();
  if (dateTo) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) errors.push("'dateTo' debe tener formato AAAA-MM-DD.");
    else filters.dateTo = dateTo;
  }
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    errors.push("'dateFrom' no puede ser posterior a 'dateTo'.");
  }

  return { filters, errors };
}

/** Construye la cláusula where de Prisma a partir de los filtros. */
export function buildWhere(filters: MeasurementFilters): Prisma.MeasurementWhereInput {
  const where: Prisma.MeasurementWhereInput = {};
  const inv: Prisma.InvestigationWhereInput = {};

  if (filters.experiment) inv.shortName = filters.experiment;
  if (filters.hardware) inv.hardware = filters.hardware;
  if (filters.gravity) inv.gravityRegime = filters.gravity;
  if (Object.keys(inv).length > 0) where.investigation = inv;
  if (filters.fuel) where.fuel = filters.fuel;

  if (filters.oxygenMin !== undefined || filters.oxygenMax !== undefined) {
    where.o2Initial = {
      ...(filters.oxygenMin !== undefined ? { gte: filters.oxygenMin } : {}),
      ...(filters.oxygenMax !== undefined ? { lte: filters.oxygenMax } : {}),
    };
  }
  if (filters.pressureMin !== undefined || filters.pressureMax !== undefined) {
    where.pressure = {
      ...(filters.pressureMin !== undefined ? { gte: filters.pressureMin } : {}),
      ...(filters.pressureMax !== undefined ? { lte: filters.pressureMax } : {}),
    };
  }
  if (filters.temperatureMin !== undefined || filters.temperatureMax !== undefined) {
    where.temperature = {
      ...(filters.temperatureMin !== undefined ? { gte: filters.temperatureMin } : {}),
      ...(filters.temperatureMax !== undefined ? { lte: filters.temperatureMax } : {}),
    };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.date.lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
  }

  return where;
}

/** Texto legible de los filtros aplicados (para PDF y logs). */
export function filtersToText(filters: MeasurementFilters): string {
  const parts: string[] = [];
  if (filters.experiment) parts.push(`experimento=${filters.experiment}`);
  if (filters.fuel) parts.push(`combustible=${filters.fuel}`);
  if (filters.oxygenMin !== undefined) parts.push(`O2 ≥ ${(filters.oxygenMin * 100).toFixed(1)}%`);
  if (filters.oxygenMax !== undefined) parts.push(`O2 ≤ ${(filters.oxygenMax * 100).toFixed(1)}%`);
  if (filters.pressureMin !== undefined) parts.push(`presión ≥ ${filters.pressureMin} atm`);
  if (filters.pressureMax !== undefined) parts.push(`presión ≤ ${filters.pressureMax} atm`);
  if (filters.temperatureMin !== undefined) parts.push(`temperatura ≥ ${filters.temperatureMin} °C`);
  if (filters.temperatureMax !== undefined) parts.push(`temperatura ≤ ${filters.temperatureMax} °C`);
  if (filters.dateFrom) parts.push(`desde ${filters.dateFrom}`);
  if (filters.dateTo) parts.push(`hasta ${filters.dateTo}`);
  return parts.length > 0 ? parts.join(", ") : "sin filtros";
}
