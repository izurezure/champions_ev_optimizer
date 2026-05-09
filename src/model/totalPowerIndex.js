export function totalPowerIndex({ dOut, v, p, n }) {
  const numerator = dOut * (v + p);
  const denominator = 1 + n * dOut * (0.5 - p);
  if (!Number.isFinite(numerator) || numerator <= 0) return 0;
  if (!Number.isFinite(denominator) || denominator <= 0.05) {
    return numerator / 0.05;
  }
  return numerator / denominator;
}
