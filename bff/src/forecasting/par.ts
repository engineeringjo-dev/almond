/**
 * Forecast → production quantities (docs/DEMAND-FORECASTING.md §4).
 *
 * Phase 0 uses a seasonal-naïve demand estimate; the newsvendor logic below is
 * model-agnostic, so swapping in ETS/LightGBM later only changes `mu`/`sigma`.
 */

export interface ItemEconomics {
  price: number; // JOD
  cost: number; // JOD
  salvage?: number; // JOD recovered per unsold unit (0 for fresh bakery)
  minBatch?: number; // can't bake half a tray
  minDisplay?: number; // minimum on display regardless of forecast
}

/** Φ⁻¹ — Acklam's inverse normal CDF approximation (|ε| < 1.15e-9). */
export function inverseNormalCdf(p: number): number {
  if (p <= 0 || p >= 1) throw new Error('p must be in (0,1)');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q: number, r: number;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * Newsvendor critical ratio: CR = Cu / (Cu + Co).
 * High-margin perishables (a croissant) justify a high service level, because
 * a lost sale costs far more than a thrown unit.
 */
export function criticalRatio(e: ItemEconomics): number {
  const cu = Math.max(0, e.price - e.cost); // lost profit per unmet unit
  const co = Math.max(0, e.cost - (e.salvage ?? 0)); // waste per unsold unit
  if (cu + co === 0) return 0.5;
  return Math.min(0.98, Math.max(0.5, cu / (cu + co))); // practical clamp
}

export interface ParInput {
  mu: number; // forecast demand for this branch × item × daypart
  sigma: number; // forecast uncertainty
  economics: ItemEconomics;
}

export interface ParResult {
  par: number;
  criticalRatio: number;
  serviceLevelZ: number;
}

/** Optimal prep quantity for one (branch × item × daypart). */
export function computePar({ mu, sigma, economics }: ParInput): ParResult {
  const cr = criticalRatio(economics);
  const z = inverseNormalCdf(cr);
  let q = mu + z * Math.max(0, sigma);
  const batch = economics.minBatch ?? 1;
  q = Math.ceil(Math.max(0, q) / batch) * batch; // round up to a whole batch
  const par = Math.max(q, economics.minDisplay ?? 0);
  return { par, criticalRatio: cr, serviceLevelZ: z };
}

/** par − on hand − already ordered → the quantity to actually prep/purchase. */
export function suggestedOrder(par: number, onHand: number, pendingIncoming = 0): number {
  return Math.max(0, Math.ceil(par - onHand - pendingIncoming));
}

/**
 * Seasonal-naïve baseline (Phase 0): demand ≈ same weekday & daypart in recent
 * weeks. Returns mean + sample stdev so it plugs straight into computePar.
 * `history` = observed quantities for the SAME (branch, item, dow, daypart).
 */
export function seasonalNaive(history: number[]): { mu: number; sigma: number } {
  if (history.length === 0) return { mu: 0, sigma: 0 };
  const mu = history.reduce((s, x) => s + x, 0) / history.length;
  if (history.length < 2) return { mu, sigma: Math.sqrt(Math.max(mu, 0)) }; // Poisson-ish prior
  const variance = history.reduce((s, x) => s + (x - mu) ** 2, 0) / (history.length - 1);
  return { mu, sigma: Math.sqrt(variance) };
}
