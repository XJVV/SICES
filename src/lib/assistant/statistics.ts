/** Estadísticas descriptivas de series (x, y) verificables y sin dependencias externas. */
type Point = [number, number];

export function analyzedPoints(pointsJson: string): Point[] {
  const parsed: unknown = JSON.parse(pointsJson);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((p): p is number[] => Array.isArray(p) && p.length >= 2 && typeof p[0] === "number" && typeof p[1] === "number" && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => [p[0], p[1]] as Point)
    .sort((a, b) => a[0] - b[0]);
}

/** Aritmética en el backend, nunca confiada a la IA. */
export function summarizePoints(points: Point[]) {
  if (!points.length) return { count: 0 };
  let min = points[0], max = points[0];
  for (const p of points) { if (p[1] < min[1]) min = p; if (p[1] > max[1]) max = p; }
  const n = points.length;
  const mx = points.reduce((a, p) => a + p[0], 0) / n;
  const my = points.reduce((a, p) => a + p[1], 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x,y] of points) { sxx += (x-mx)**2; sxy += (x-mx)*(y-my); syy += (y-my)**2; }
  const slope = sxx > 0 ? sxy / sxx : null;
  const rSquared = sxx > 0 && syy > 0 ? Math.min(1, Math.max(0, sxy**2/(sxx*syy))) : null;
  const sampleCount = Math.min(12, n);
  const sample = Array.from({ length: sampleCount }, (_, i) => points[Math.round(i * (n-1) / Math.max(1, sampleCount-1))]);
  return {
    count: n, xRange: [points[0][0],points[n-1][0]],
    yMin: { x: min[0], y: min[1] }, yMax: { x: max[0], y: max[1] },
    first: points[0], last: points[n-1], meanY: my,
    linearSlope: Number.isFinite(slope) ? slope : null,
    linearRSquared: Number.isFinite(rSquared) ? rSquared : null,
    samplePoints: sample, sampleIsReduced: sampleCount < n,
  };
}

