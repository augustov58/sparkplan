/**
 * Default Pricing — starting unit prices for auto-takeoff.
 *
 * Phase 1 (per plan §4.5): a tiny built-in table the auto-takeoff function
 * uses to seed line items. The user can edit any line in the takeoff tab. The
 * goal is reasonable starting values, not commodity-accurate prices.
 *
 * Phase 4 will replace this module with live supplier feeds (Lowe's Pro,
 * Home Depot, Graybar/Rexel). When that ships, callers should keep the same
 * function signatures so the rest of the codebase doesn't churn.
 *
 * All prices are USD. Sources: composite of Home Depot Pro / Lowe's Pro online
 * 2025 list pricing for residential-grade materials. Update annually.
 *
 * NEVER throw — unknown inputs return a `{ unitCost, unitPrice, source: 'fallback' }`
 * shape with conservative defaults so the takeoff still produces output.
 */

export interface PriceQuote {
  /** Internal cost per unit. */
  unitCost: number;
  /** Billed price per unit. Defaults to unitCost × 1.25 (a 25% material markup). */
  unitPrice: number;
  /** Where the price came from. 'fallback' means we didn't recognize the input. */
  source: 'table' | 'fallback';
  /** Human-readable label used in the auto-takeoff description. */
  label: string;
  /** Default unit (ea / ft / hr / lf). */
  unit: string;
}

const MATERIAL_MARKUP = 1.25;

const round2 = (n: number) => Math.round(n * 100) / 100;

const quote = (
  unitCost: number,
  label: string,
  unit: string,
  source: 'table' | 'fallback' = 'table',
  customMarkup?: number
): PriceQuote => ({
  unitCost: round2(unitCost),
  unitPrice: round2(unitCost * (customMarkup ?? MATERIAL_MARKUP)),
  source,
  label,
  unit,
});

// ============================================
// Panels — keyed by main breaker amps
// ============================================

const PANEL_PRICES_BY_BUS_RATING: Record<number, { cost: number; label: string }> = {
  100: { cost: 185, label: '100A panel + main breaker' },
  125: { cost: 235, label: '125A panel + main breaker' },
  150: { cost: 305, label: '150A panel + main breaker' },
  200: { cost: 620, label: '200A panel + main breaker' },
  225: { cost: 720, label: '225A panel + main breaker' },
  400: { cost: 1450, label: '400A panel + main breaker' },
  600: { cost: 2900, label: '600A switchboard' },
  800: { cost: 3900, label: '800A switchboard' },
};

export function panelPrice(busRatingAmps: number, isMain: boolean): PriceQuote {
  // Find the closest tier at or above the requested bus rating.
  const tiers = Object.keys(PANEL_PRICES_BY_BUS_RATING)
    .map((k) => Number(k))
    .sort((a, b) => a - b);
  const tier = tiers.find((t) => busRatingAmps <= t) ?? tiers[tiers.length - 1];
  const entry = PANEL_PRICES_BY_BUS_RATING[tier];

  if (!entry) {
    // Fallback for absurd inputs (≥1000A or non-finite).
    return quote(busRatingAmps * 5, `${busRatingAmps}A panel (estimated)`, 'ea', 'fallback');
  }

  const label = isMain ? `MDP — ${entry.label}` : entry.label;
  return quote(entry.cost, label, 'ea');
}

// ============================================
// Conductors — by AWG/kcmil + material, $ / ft
// ============================================

const CONDUCTOR_COST_PER_FT: Record<string, { cu: number; al: number }> = {
  '14': { cu: 0.45, al: 0.30 },
  '12': { cu: 0.65, al: 0.40 },
  '10': { cu: 1.05, al: 0.62 },
  '8':  { cu: 1.85, al: 1.05 },
  '6':  { cu: 2.95, al: 1.65 },
  '4':  { cu: 4.35, al: 2.40 },
  '3':  { cu: 5.20, al: 2.85 },
  '2':  { cu: 6.30, al: 3.40 },
  '1':  { cu: 7.95, al: 4.30 },
  '1/0': { cu: 9.85,  al: 5.35 },
  '2/0': { cu: 12.20, al: 6.65 },
  '3/0': { cu: 14.95, al: 8.20 },
  '4/0': { cu: 18.40, al: 10.10 },
  '250': { cu: 22.10, al: 12.20 },
  '350': { cu: 30.85, al: 17.05 },
  '500': { cu: 43.30, al: 23.95 },
};

export function conductorPricePerFoot(
  size: string | null | undefined,
  material: 'Cu' | 'Al' | string
): PriceQuote {
  const key = size ?? '';
  const entry = CONDUCTOR_COST_PER_FT[key];
  if (!entry) {
    // Conservative fallback. Unknown size (often a kcmil > 500 or stripped
    // string). Don't break takeoff — give a placeholder so the user knows to edit.
    return quote(
      4.0,
      `Conductor ${key || '(size unknown)'} — please verify`,
      'ft',
      'fallback'
    );
  }
  const matKey = material === 'Al' ? 'al' : 'cu';
  const cost = entry[matKey];
  const matLabel = matKey === 'cu' ? 'Cu' : 'Al';
  return quote(cost, `${size} AWG ${matLabel} THHN`, 'ft');
}

// ============================================
// Conduit + fittings — $ / ft (rolled-up estimate)
// ============================================

const CONDUIT_COST_PER_FT: Record<string, { emt: number; pvc: number }> = {
  '0.5':  { emt: 1.10, pvc: 0.65 },
  '0.75': { emt: 1.45, pvc: 0.80 },
  '1':    { emt: 2.15, pvc: 1.10 },
  '1.25': { emt: 2.85, pvc: 1.50 },
  '1.5':  { emt: 3.40, pvc: 1.85 },
  '2':    { emt: 4.20, pvc: 2.40 },
  '2.5':  { emt: 6.20, pvc: 3.50 },
  '3':    { emt: 8.50, pvc: 4.80 },
  '3.5':  { emt: 10.50, pvc: 6.20 },
  '4':    { emt: 12.95, pvc: 7.85 },
};

export function conduitPricePerFoot(
  size: string | null | undefined,
  type: string | null | undefined
): PriceQuote {
  const key = (size ?? '').toString();
  const entry = CONDUIT_COST_PER_FT[key];
  const isEmt = (type ?? '').toUpperCase() === 'EMT';
  if (!entry) {
    return quote(
      2.5,
      `Conduit ${key || '(size unknown)'} — please verify`,
      'ft',
      'fallback'
    );
  }
  const cost = isEmt ? entry.emt : entry.pvc;
  const label = `${key}" ${isEmt ? 'EMT' : 'PVC'} conduit + fittings`;
  return quote(cost, label, 'ft');
}

// ============================================
// Branch circuits — bundled material per circuit
// ============================================
// "Branch circuit bundle" = wire (~30ft 12 AWG), 1P breaker, box, device, plate.
// Adjusted by breaker amps. Customer can edit per-line.

const CIRCUIT_BUNDLE_BY_AMPS: Record<number, { cost: number; label: string }> = {
  15: { cost: 22.50, label: '15A 1P branch circuit (wire + breaker + device)' },
  20: { cost: 24.50, label: '20A 1P branch circuit (wire + breaker + device)' },
  30: { cost: 38.00, label: '30A 1P branch circuit (10 AWG + breaker)' },
  40: { cost: 52.00, label: '40A 2P branch circuit (8 AWG + breaker)' },
  50: { cost: 68.00, label: '50A 2P branch circuit (8 AWG + receptacle)' },
  60: { cost: 88.00, label: '60A 2P branch circuit (6 AWG)' },
};

export function branchCircuitBundlePrice(breakerAmps: number, pole: number): PriceQuote {
  const tiers = Object.keys(CIRCUIT_BUNDLE_BY_AMPS)
    .map((k) => Number(k))
    .sort((a, b) => a - b);
  const tier = tiers.find((t) => breakerAmps <= t) ?? tiers[tiers.length - 1];
  const entry = CIRCUIT_BUNDLE_BY_AMPS[tier];

  if (!entry) {
    return quote(
      breakerAmps * 1.5,
      `${breakerAmps}A branch circuit (estimated)`,
      'ea',
      'fallback'
    );
  }

  // 2P/3P circuits use about 1.6× / 2.4× the 1P bundle cost.
  const poleMultiplier = pole >= 3 ? 2.4 : pole === 2 ? 1.6 : 1;
  return quote(entry.cost * poleMultiplier, entry.label, 'ea');
}

// ============================================
// Transformers — by kVA
// ============================================

const TRANSFORMER_PRICES_BY_KVA: Record<number, { cost: number; label: string }> = {
  15:  { cost: 1450, label: '15 kVA dry-type transformer' },
  30:  { cost: 2200, label: '30 kVA dry-type transformer' },
  45:  { cost: 2950, label: '45 kVA dry-type transformer' },
  75:  { cost: 4400, label: '75 kVA dry-type transformer' },
  112: { cost: 5800, label: '112.5 kVA dry-type transformer' },
  150: { cost: 7600, label: '150 kVA dry-type transformer' },
  225: { cost: 10500, label: '225 kVA dry-type transformer' },
  300: { cost: 14200, label: '300 kVA dry-type transformer' },
};

export function transformerPrice(kvaRating: number): PriceQuote {
  const tiers = Object.keys(TRANSFORMER_PRICES_BY_KVA)
    .map((k) => Number(k))
    .sort((a, b) => a - b);
  const tier = tiers.find((t) => kvaRating <= t) ?? tiers[tiers.length - 1];
  const entry = TRANSFORMER_PRICES_BY_KVA[tier];
  if (!entry) {
    return quote(kvaRating * 60, `${kvaRating} kVA transformer (estimated)`, 'ea', 'fallback');
  }
  return quote(entry.cost, entry.label, 'ea');
}

// ============================================
// Labor — defaults (NECA-derived rough cuts)
// ============================================
// These are conservative defaults the user is *expected* to override. NECA
// Manual of Labor Units is licensed and we don't ship its values; users with
// their own time studies plug in their numbers.

export const LABOR_DEFAULTS = {
  /** Default shop labor rate in USD/hour (loaded for fully-burdened cost). */
  rateUsdPerHour: 95,
  /** Hours per foot of feeder run (rough-in + termination + dressing). */
  hoursPerFootFeeder: 0.05,
  /** Hours to install a single panel (mount + interior + bonding). */
  hoursPerPanel: 4,
  /** Hours per branch circuit (homerun + box + device + plate, average). */
  hoursPerBranchCircuit: 1.5,
  /** Hours to set + hook up a transformer (≤75 kVA). */
  hoursPerTransformer: 6,
};

/**
 * Convenience: convert hours to a labor line "unit price" assuming the default
 * rate. Used by auto-takeoff to seed editable hours-rate splits.
 */
export function laborPriceForHours(hours: number, rate: number = LABOR_DEFAULTS.rateUsdPerHour): PriceQuote {
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 0;
  return {
    unitCost: round2(rate),
    unitPrice: round2(rate),
    source: 'table',
    label: `Labor @ $${rate.toFixed(2)}/hr × ${safeHours.toFixed(2)} hr`,
    unit: 'hr',
  };
}
