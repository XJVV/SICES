export type CombustionType = "SOLID_SURFACE" | "AEROSOL" | "LIQUID_DROPLET" | "GASEOUS";
export type Category = "PRINCIPAL" | "COMPLEMENTARIA";

export const COMBUSTION_TYPES: CombustionType[] = [
  "SOLID_SURFACE",
  "AEROSOL",
  "LIQUID_DROPLET",
  "GASEOUS",
];

export const CATEGORIES: Category[] = ["PRINCIPAL", "COMPLEMENTARIA"];

export interface FuelRef {
  id: number;
  name: string;
  type: string;
}

export interface Investigation {
  id: number;
  psiCode: string;
  agency?: string;
  hardware?: string;
  gravityRegime?: string;
  laymanSummary?: string;
  earthApplication?: string;
  safetyDomain?: string;
  shortName: string;
  name: string;
  category: Category;
  combustionType: CombustionType;
  platform: string;
  period: string;
  startDate: string | null;
  endDate: string | null;
  investigator: string;
  doi: string;
  psiUrl: string;
  description: string;
  objectives: string;
  methodology: string;
  fuel: string;
  oxygen: string;
  pressure: string;
  temperature: string;
  flow: string;
  results: string;
  conclusions: string;
  dataAvailable: string;
  filesCount: number | null;
  createdAt: string;
  updatedAt: string;
  fuels?: FuelRef[];
  _count?: { publications: number; measurements?: number; variables?: number };
}

export interface Variable {
  id: number;
  investigationId: number;
  name: string;
  unit: string;
  dataType: string;
  description: string;
  investigation?: { shortName: string; psiCode: string };
}

export interface Measurement {
  id: number;
  investigationId: number;
  fuel: string;
  date: string | null;
  o2Initial: number | null;
  o2Final: number | null;
  co2: number | null;
  co: number | null;
  pressure: number | null;
  temperature: number | null;
  flow: number | null;
  radiation: number | null;
  propagationSpeed: number | null;
  frames: number | null;
  result: string;
  source: string;
  createdAt?: string;
  investigation?: { id: number; psiCode: string; shortName: string };
}

export interface MeasurementStats {
  total: number;
  o2InitialMin: number | null;
  o2InitialMax: number | null;
  pressureMin: number | null;
  pressureMax: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  propagationMin: number | null;
  propagationMax: number | null;
  dateMin: string | null;
  dateMax: string | null;
  avg: {
    o2Initial: number | null;
    o2Final: number | null;
    co2: number | null;
    co: number | null;
    pressure: number | null;
    temperature: number | null;
    flow: number | null;
    radiation: number | null;
    propagationSpeed: number | null;
  };
  byExperiment: { shortName: string; psiCode: string; combustionType: string; count: number }[];
}

export interface MeasurementFiltersState {
  experiment?: string;
  fuel?: string;
  oxygenMin?: number;
  oxygenMax?: number;
  pressureMin?: number;
  pressureMax?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface MeasurementsResponse {
  rows: Measurement[];
  stats: MeasurementStats;
  error?: string;
}

export interface CatalogFuel {
  id: number;
  name: string;
  type: string;
  description: string;
  investigationsCount: number;
  measurementsCount: number;
}

export interface CatalogResponse {
  fuels: CatalogFuel[];
  investigations: {
    id: number;
    psiCode: string;
    shortName: string;
    category: Category;
    combustionType: CombustionType;
    _count: { measurements: number; publications: number; variables: number };
  }[];
  variables: Variable[];
}

export interface Publication {
  id: number;
  citation: string;
  year: number | null;
  url: string;
  investigationId: number;
  investigation?: { id: number; psiCode: string; shortName: string };
  createdAt: string;
  updatedAt: string;
}

/* ------- Datos analizados (series reales de publicaciones) ------- */

export type SeriesSource = "EXPERIMENT" | "SIMULATION" | "MODEL";

export interface AnalyzedSeries {
  id: number;
  metric: string;
  xKind: string; // time_s | time_norm | pressure_atm | diameter_mm
  xUnit: string;
  yUnit: string;
  label: string;
  source: SeriesSource;
  sort: number;
  /** [x, y] o [x, y, errSuperior, errInferior] (límites absolutos) */
  points: number[][];
  rawPointCount?: number;
  decimated?: boolean;
}

export interface AnalyzedDataset {
  id: number;
  key: string;
  investigationId: number;
  investigation: {
    id: number;
    psiCode: string;
    shortName: string;
    name: string;
    combustionType: CombustionType;
  };
  nameEs: string;
  nameEn: string;
  tag: string;
  fuel: string;
  condition: string;
  doi: string;
  reference: string;
  sort: number;
  series: AnalyzedSeries[];
}

export interface InvestigationInput {
  psiCode: string;
  shortName: string;
  name: string;
  category: Category;
  combustionType: CombustionType;
  platform: string;
  period: string;
  investigator: string;
  doi: string;
  psiUrl: string;
  description: string;
  objectives: string;
  methodology: string;
  fuel: string;
  oxygen: string;
  pressure: string;
  temperature: string;
  flow: string;
  results: string;
  conclusions: string;
  dataAvailable: string;
  filesCount: number | null;
}

export interface PublicationInput {
  citation: string;
  year: number | null;
  url: string;
  investigationId: number;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface QueryHistoryItem {
  id: number;
  filters: MeasurementFiltersState;
  results: number;
  createdAt: string;
}

// Paleta futurista (cian + ámbar sobre espacio profundo, sin azules/índigos)
export const COMBUSTION_COLORS: Record<CombustionType, string> = {
  SOLID_SURFACE:
    "bg-amber-500/10 text-amber-300 border-amber-500/30",
  AEROSOL: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
  LIQUID_DROPLET: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  GASEOUS: "bg-rose-500/10 text-rose-300 border-rose-500/30",
};

export const CHART_COLORS: Record<CombustionType, string> = {
  SOLID_SURFACE: "#f59e0b",
  AEROSOL: "#a1a1aa",
  LIQUID_DROPLET: "#34d399",
  GASEOUS: "#fb7185",
};

export const SERIES_PALETTE = [
  "#22d3ee", // cian
  "#f59e0b", // ámbar
  "#34d399", // esmeralda
  "#fb7185", // rosa
  "#a78bfa", // violeta suave (solo series)
  "#facc15", // amarillo
  "#2dd4bf", // turquesa
  "#f472b6", // rosa claro
];
