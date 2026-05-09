/**
 * Auto-takeoff from project — the killer feature.
 *
 * Reads the existing project model (panels, circuits, feeders, transformers)
 * and emits a list of estimate line items. This is what makes SparkPlan's
 * estimating tool different from IntelliBid / Accubid: the contractor doesn't
 * start from a blank sheet, they start from the project they already built.
 *
 * Per plan §4.5:
 *   - For each panel: emit material row (panel + main breaker) + labor row
 *     (set + interior + bonding).
 *   - For each feeder: emit conductor row (qty = distance × phase × sets +
 *     neutral + EGC), conduit + fittings row, labor row.
 *   - For each circuit: emit branch-circuit bundle row + per-circuit labor.
 *   - For each transformer: emit panel-board cost + setting-and-hookup labor.
 *
 * Per plan §5 decision 4: this is a one-time **snapshot**. The output rows
 * include `source_kind` + `source_id` so the UI can show "from panel MDP"
 * affordances, but subsequent project edits do NOT propagate. Re-running
 * auto-takeoff on an existing estimate appends rows; it does not reconcile.
 *
 * Pure function. No DB calls. Returns line-item *seeds* the caller persists.
 */

import type { Database } from '@/lib/database.types';
import {
  branchCircuitBundlePrice,
  conductorPricePerFoot,
  conduitPricePerFoot,
  laborPriceForHours,
  LABOR_DEFAULTS,
  panelPrice,
  transformerPrice,
} from './defaultPricing';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];
type Feeder = Database['public']['Tables']['feeders']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];

/**
 * Shape of the rows the takeoff emits. Matches the Insert shape of
 * `estimate_line_items` minus the FK fields the caller fills in
 * (estimate_id, user_id) and the audit fields the DB fills in.
 */
export interface AutoTakeoffLineItem {
  position: number;
  category: 'material' | 'labor' | 'equipment' | 'subcontract' | 'other';
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  unit_price: number;
  line_total: number;
  source_kind: 'panel' | 'feeder' | 'circuit' | 'transformer' | 'manual' | 'assembly';
  source_id: string | null;
  taxable: boolean;
  notes: string | null;
}

export interface AutoTakeoffInput {
  panels: Panel[];
  circuits: Circuit[];
  feeders: Feeder[];
  transformers: Transformer[];
}

export interface AutoTakeoffResult {
  lineItems: AutoTakeoffLineItem[];
  /** Counts for a "we just added N panels, M circuits..." summary toast. */
  counts: {
    panels: number;
    feeders: number;
    circuits: number;
    transformers: number;
    total: number;
  };
  /** Advisory warnings — fallback prices, missing dimensions, etc. */
  warnings: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const lineTotal = (qty: number, price: number) => round2(qty * price);

/**
 * Walk a project's electrical model and emit a starter list of estimate
 * line items. Order matches a logical takeoff workflow:
 *   1. Service equipment (MDP)
 *   2. Sub-panels
 *   3. Transformers
 *   4. Feeders (conductors + conduit + labor)
 *   5. Branch circuits, grouped by panel
 */
export function autoTakeoffFromProject(input: AutoTakeoffInput): AutoTakeoffResult {
  const warnings: string[] = [];
  const items: AutoTakeoffLineItem[] = [];
  let pos = 0;

  const counts = {
    panels: 0,
    feeders: 0,
    circuits: 0,
    transformers: 0,
    total: 0,
  };

  // ---- 1. Panels (MDP first, then sub-panels by name) ----
  const sortedPanels = [...input.panels].sort((a, b) => {
    if (a.is_main && !b.is_main) return -1;
    if (!a.is_main && b.is_main) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const panel of sortedPanels) {
    const busRating =
      panel.main_breaker_amps && panel.main_breaker_amps > 0
        ? panel.main_breaker_amps
        : panel.bus_rating;

    const matQuote = panelPrice(busRating, !!panel.is_main);
    if (matQuote.source === 'fallback') {
      warnings.push(
        `INFO: Panel "${panel.name}" (${busRating}A) used fallback pricing — please verify.`
      );
    }
    items.push({
      position: pos++,
      category: 'material',
      description: `${panel.name} — ${matQuote.label}`,
      quantity: 1,
      unit: matQuote.unit,
      unit_cost: matQuote.unitCost,
      unit_price: matQuote.unitPrice,
      line_total: lineTotal(1, matQuote.unitPrice),
      source_kind: 'panel',
      source_id: panel.id,
      taxable: true,
      notes: panel.location ? `Location: ${panel.location}` : null,
    });

    // Labor for the panel: mount + interior + bonding.
    const laborHours = LABOR_DEFAULTS.hoursPerPanel;
    const laborQuote = laborPriceForHours(laborHours);
    items.push({
      position: pos++,
      category: 'labor',
      description: `${panel.name} — install + bond (set + interior + grounding)`,
      quantity: laborHours,
      unit: 'hr',
      unit_cost: laborQuote.unitCost,
      unit_price: laborQuote.unitPrice,
      line_total: lineTotal(laborHours, laborQuote.unitPrice),
      source_kind: 'panel',
      source_id: panel.id,
      taxable: false,
      notes: null,
    });

    counts.panels++;
  }

  // ---- 2. Transformers ----
  const sortedTransformers = [...input.transformers].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  for (const tx of sortedTransformers) {
    const txQuote = transformerPrice(tx.kva_rating);
    if (txQuote.source === 'fallback') {
      warnings.push(
        `INFO: Transformer "${tx.name}" (${tx.kva_rating} kVA) used fallback pricing.`
      );
    }
    items.push({
      position: pos++,
      category: 'material',
      description: `${tx.name} — ${txQuote.label}`,
      quantity: 1,
      unit: txQuote.unit,
      unit_cost: txQuote.unitCost,
      unit_price: txQuote.unitPrice,
      line_total: lineTotal(1, txQuote.unitPrice),
      source_kind: 'transformer',
      source_id: tx.id,
      taxable: true,
      notes: `${tx.primary_voltage}V / ${tx.secondary_voltage}V`,
    });

    const laborHours = LABOR_DEFAULTS.hoursPerTransformer;
    const laborQuote = laborPriceForHours(laborHours);
    items.push({
      position: pos++,
      category: 'labor',
      description: `${tx.name} — set, terminate, and energize`,
      quantity: laborHours,
      unit: 'hr',
      unit_cost: laborQuote.unitCost,
      unit_price: laborQuote.unitPrice,
      line_total: lineTotal(laborHours, laborQuote.unitPrice),
      source_kind: 'transformer',
      source_id: tx.id,
      taxable: false,
      notes: null,
    });

    counts.transformers++;
  }

  // ---- 3. Feeders ----
  const sortedFeeders = [...input.feeders].sort((a, b) => a.name.localeCompare(b.name));
  for (const feeder of sortedFeeders) {
    const distance = Number.isFinite(feeder.distance_ft) ? feeder.distance_ft : 0;
    if (distance <= 0) {
      warnings.push(
        `INFO: Feeder "${feeder.name}" has no distance — conductor + conduit qty defaulted to 0.`
      );
    }
    const sets = Math.max(1, feeder.sets_in_parallel ?? 1);
    const phaseSize = feeder.phase_conductor_size ?? '';
    const neutralSize = feeder.neutral_conductor_size ?? phaseSize;
    const egcSize = feeder.egc_size ?? '';
    const material = (feeder.conductor_material ?? 'Cu') as 'Cu' | 'Al';

    // Phase conductors. For a 3-conductor feeder w/ 1 set in parallel, qty = 3 × distance.
    // For Phase 1 we approximate by emitting one row per kind (phase / neutral / EGC),
    // each with qty = distance × sets. Matches NEC 310.10(H) parallel-set sizing.
    const phaseQuote = conductorPricePerFoot(phaseSize, material);
    if (phaseQuote.source === 'fallback') {
      warnings.push(
        `INFO: Feeder "${feeder.name}" phase conductor "${phaseSize}" used fallback pricing.`
      );
    }
    // Number of phase conductors: 3 for 3-phase (assumed), 2 for single-phase
    // (approximated as 3-phase for simplicity in Phase 1; the user edits per-line).
    const phaseConductorCount = 3;
    const phaseQty = distance * sets * phaseConductorCount;
    items.push({
      position: pos++,
      category: 'material',
      description: `${feeder.name} — phase conductors ${phaseSize} ${material} (${sets}× set, ${phaseConductorCount} per set)`,
      quantity: round2(phaseQty),
      unit: phaseQuote.unit,
      unit_cost: phaseQuote.unitCost,
      unit_price: phaseQuote.unitPrice,
      line_total: lineTotal(phaseQty, phaseQuote.unitPrice),
      source_kind: 'feeder',
      source_id: feeder.id,
      taxable: true,
      notes: null,
    });

    if (neutralSize) {
      const neutralQuote = conductorPricePerFoot(neutralSize, material);
      const neutralQty = distance * sets;
      items.push({
        position: pos++,
        category: 'material',
        description: `${feeder.name} — neutral conductor ${neutralSize} ${material}`,
        quantity: round2(neutralQty),
        unit: neutralQuote.unit,
        unit_cost: neutralQuote.unitCost,
        unit_price: neutralQuote.unitPrice,
        line_total: lineTotal(neutralQty, neutralQuote.unitPrice),
        source_kind: 'feeder',
        source_id: feeder.id,
        taxable: true,
        notes: null,
      });
    }

    if (egcSize) {
      // EGC sized per NEC 250.122; one EGC per raceway (not per set).
      const egcQuote = conductorPricePerFoot(egcSize, material);
      const egcQty = distance;
      items.push({
        position: pos++,
        category: 'material',
        description: `${feeder.name} — equipment grounding conductor ${egcSize} ${material}`,
        quantity: round2(egcQty),
        unit: egcQuote.unit,
        unit_cost: egcQuote.unitCost,
        unit_price: egcQuote.unitPrice,
        line_total: lineTotal(egcQty, egcQuote.unitPrice),
        source_kind: 'feeder',
        source_id: feeder.id,
        taxable: true,
        notes: 'NEC 250.122',
      });
    }

    // Conduit + fittings
    const conduitQuote = conduitPricePerFoot(feeder.conduit_size, feeder.conduit_type);
    if (conduitQuote.source === 'fallback') {
      warnings.push(
        `INFO: Feeder "${feeder.name}" conduit ${feeder.conduit_size ?? 'unknown'} used fallback pricing.`
      );
    }
    items.push({
      position: pos++,
      category: 'material',
      description: `${feeder.name} — ${conduitQuote.label}`,
      quantity: distance,
      unit: 'ft',
      unit_cost: conduitQuote.unitCost,
      unit_price: conduitQuote.unitPrice,
      line_total: lineTotal(distance, conduitQuote.unitPrice),
      source_kind: 'feeder',
      source_id: feeder.id,
      taxable: true,
      notes: null,
    });

    // Labor
    const feederHours = round2(distance * LABOR_DEFAULTS.hoursPerFootFeeder);
    const laborQuote = laborPriceForHours(feederHours);
    items.push({
      position: pos++,
      category: 'labor',
      description: `${feeder.name} — pull + terminate (${distance.toFixed(0)} ft @ ${LABOR_DEFAULTS.hoursPerFootFeeder} hr/ft)`,
      quantity: feederHours,
      unit: 'hr',
      unit_cost: laborQuote.unitCost,
      unit_price: laborQuote.unitPrice,
      line_total: lineTotal(feederHours, laborQuote.unitPrice),
      source_kind: 'feeder',
      source_id: feeder.id,
      taxable: false,
      notes: null,
    });

    counts.feeders++;
  }

  // ---- 4. Branch circuits (grouped by panel for tidy output) ----
  // Group circuits by panel, then emit a single per-circuit row plus a
  // bundled labor row for the whole panel's circuits. This avoids 1,000
  // labor lines on a 200-space panel schedule.
  const circuitsByPanel = new Map<string, Circuit[]>();
  for (const c of input.circuits) {
    const pid = c.panel_id ?? '__unassigned__';
    if (!circuitsByPanel.has(pid)) circuitsByPanel.set(pid, []);
    circuitsByPanel.get(pid)!.push(c);
  }

  for (const [panelId, circuits] of circuitsByPanel) {
    const panel = input.panels.find((p) => p.id === panelId);
    const panelLabel = panel ? panel.name : 'unassigned';

    // Sort by circuit number for stable output.
    const sorted = [...circuits].sort((a, b) => a.circuit_number - b.circuit_number);

    for (const c of sorted) {
      const bundleQuote = branchCircuitBundlePrice(c.breaker_amps, c.pole);
      items.push({
        position: pos++,
        category: 'material',
        description: `${panelLabel} ckt ${c.circuit_number} — ${c.description} (${bundleQuote.label})`,
        quantity: 1,
        unit: bundleQuote.unit,
        unit_cost: bundleQuote.unitCost,
        unit_price: bundleQuote.unitPrice,
        line_total: lineTotal(1, bundleQuote.unitPrice),
        source_kind: 'circuit',
        source_id: c.id,
        taxable: true,
        notes: c.load_type ?? null,
      });
      counts.circuits++;
    }

    // Bundled labor for this panel's circuits.
    if (sorted.length > 0) {
      const totalHours = round2(sorted.length * LABOR_DEFAULTS.hoursPerBranchCircuit);
      const laborQuote = laborPriceForHours(totalHours);
      items.push({
        position: pos++,
        category: 'labor',
        description: `${panelLabel} — branch circuit rough-in + trim (${sorted.length} circuits @ ${LABOR_DEFAULTS.hoursPerBranchCircuit} hr each)`,
        quantity: totalHours,
        unit: 'hr',
        unit_cost: laborQuote.unitCost,
        unit_price: laborQuote.unitPrice,
        line_total: lineTotal(totalHours, laborQuote.unitPrice),
        source_kind: 'panel',
        source_id: panel?.id ?? null,
        taxable: false,
        notes: null,
      });
    }
  }

  counts.total = items.length;

  if (counts.total === 0) {
    warnings.push(
      'INFO: Project has no panels, feeders, circuits, or transformers yet — auto-takeoff produced no rows.'
    );
  }

  return { lineItems: items, counts, warnings };
}
