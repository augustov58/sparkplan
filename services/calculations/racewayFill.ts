/**
 * Branch-circuit wire and raceway take-off (#304, owner ruling 2026-11-23).
 *
 * - Conductors per circuit = its poles, plus 1 neutral on a 1-pole circuit.
 *   A multi-pole circuit's neutral can't be known from the circuit row.
 * - Each circuit's EMT is sized from NEC Chapter 9 at 40 % fill (Table 1,
 *   three or more conductors), its equipment grounding conductor included:
 *   conductor areas from Table 5 (THHN), raceway areas from Table 4 (EMT).
 * - Run lengths are estimates kept from the take-off as it was: ~50 ft of wire
 *   per circuit and ~10 ft of raceway per circuit (10 ft sticks).
 *
 * Pure: no DB, no hooks; never throws (an unsizable circuit lands in "TBD"
 * with a warning).
 */

import { getConductorDimensions } from '../../data/nec/chapter9-conductor-dimensions';
import { EMT_DIMENSIONS } from '../../data/nec/chapter9-conduit-dimensions';

/** Estimated wire run per branch circuit (ft), as the take-off has always assumed. */
export const WIRE_FT_PER_CIRCUIT = 50;
/** Estimated raceway per branch circuit (ft), as the take-off has always assumed. */
export const RACEWAY_FT_PER_CIRCUIT = 10;
/** Chapter 9 Table 1: over 2 conductors, 40 % of the raceway's area. */
export const RACEWAY_FILL_FRACTION = 0.4;

export interface TakeoffCircuit {
  pole: number;
  conductor_size: string | null;
  egc_size?: string | null;
}

export interface TakeoffLine {
  category: string;
  description: string;
  quantity: number;
  unit: string;
  size?: string;
  notes?: string;
}

/**
 * Outlet and junction boxes, estimated from the 1-pole circuits only (owner
 * ruling 2026-11-24, #321): ~60 % of them get an outlet box (receptacles,
 * switches) and ~20 % a junction box. Feeder and equipment circuits (2- and
 * 3-pole) get none, so a panel of them lists no boxes.
 */
export const OUTLET_BOXES_PER_1_POLE_CIRCUIT = 0.6;
export const JUNCTION_BOXES_PER_1_POLE_CIRCUIT = 0.2;

export function boxEstimate(circuits: ReadonlyArray<{ pole: number }>): { onePoleCircuits: number; outletBoxes: number; junctionBoxes: number } {
  const onePoleCircuits = circuits.filter((c) => c.pole === 1).length;
  return {
    onePoleCircuits,
    outletBoxes: Math.floor(onePoleCircuits * OUTLET_BOXES_PER_1_POLE_CIRCUIT),
    junctionBoxes: Math.floor(onePoleCircuits * JUNCTION_BOXES_PER_1_POLE_CIRCUIT),
  };
}

/** Conductors pulled for a circuit, EGC not counted (#304): the poles, plus a neutral on 1-pole. */
export function conductorsPerCircuit(pole: number): number {
  return pole === 1 ? 2 : pole;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The smallest EMT trade size whose 40 % area holds the circuit's conductors
 * and its EGC (THHN). `tradeSize` is null when a size isn't in the tables.
 */
export function emtTradeSizeForCircuit(c: TakeoffCircuit): {
  tradeSize: string | null;
  fillAreaIn2: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const phase = c.conductor_size ? getConductorDimensions(c.conductor_size, 'THHN') : null;
  const egc = c.egc_size ? getConductorDimensions(c.egc_size, 'THHN') : null;
  if (!phase) {
    warnings.push(`No Chapter 9 area for conductor "${c.conductor_size ?? '—'}"; raceway not sized.`);
    return { tradeSize: null, fillAreaIn2: 0, warnings };
  }
  if (c.egc_size && !egc) warnings.push(`No Chapter 9 area for EGC "${c.egc_size}"; sized without it.`);
  const fillAreaIn2 = conductorsPerCircuit(c.pole) * phase.area + (egc?.area ?? 0);
  const raceway = EMT_DIMENSIONS.find((d) => d.area40 >= fillAreaIn2);
  if (!raceway) {
    warnings.push(`${fillAreaIn2.toFixed(4)} in² exceeds the largest EMT at 40 % fill; raceway not sized.`);
    return { tradeSize: null, fillAreaIn2, warnings };
  }
  return { tradeSize: raceway.tradeSize, fillAreaIn2, warnings };
}

/**
 * The take-off's wire, EGC and (optionally) EMT lines for a set of branch
 * circuits. Wire is rounded up to the next 100 ft per size; EMT is totalled
 * by trade size in 10 ft sticks.
 */
export function branchWiringTakeoff(
  circuits: ReadonlyArray<TakeoffCircuit>,
  includeConduit: boolean,
): { items: TakeoffLine[]; warnings: string[] } {
  const items: TakeoffLine[] = [];
  const warnings: string[] = [];

  const wire = new Map<string, { circuits: number; conductors: number }>();
  const egc = new Map<string, number>();
  const raceway = new Map<string, number>();

  for (const c of circuits) {
    if (c.conductor_size) {
      const w = wire.get(c.conductor_size) ?? { circuits: 0, conductors: 0 };
      w.circuits += 1;
      w.conductors += conductorsPerCircuit(c.pole);
      wire.set(c.conductor_size, w);
    }
    if (c.egc_size) egc.set(c.egc_size, (egc.get(c.egc_size) ?? 0) + 1);
    if (includeConduit) {
      const r = emtTradeSizeForCircuit(c);
      warnings.push(...r.warnings);
      const key = r.tradeSize ?? 'TBD';
      raceway.set(key, (raceway.get(key) ?? 0) + 1);
    }
  }

  for (const [size, w] of wire) {
    items.push({
      category: 'Wire & Cable',
      description: 'THHN/THWN Copper Wire',
      quantity: Math.ceil((w.conductors * WIRE_FT_PER_CIRCUIT) / 100) * 100,
      unit: 'ft',
      size,
      notes: `${plural(w.circuits, 'circuit')}, ${plural(w.conductors, 'conductor')} @ ~${WIRE_FT_PER_CIRCUIT}ft avg`,
    });
  }

  for (const [size, count] of egc) {
    items.push({
      category: 'Wire & Cable',
      description: 'Bare or Green Equipment Grounding Conductor',
      quantity: Math.ceil((count * WIRE_FT_PER_CIRCUIT) / 100) * 100,
      unit: 'ft',
      size,
      notes: `${plural(count, 'circuit')} @ ~${WIRE_FT_PER_CIRCUIT}ft avg`,
    });
  }

  // Smallest trade size first; "TBD" last
  const order = (s: string) => (s === 'TBD' ? Infinity : EMT_DIMENSIONS.findIndex((d) => d.tradeSize === s));
  for (const [size, count] of [...raceway].sort((a, b) => order(a[0]) - order(b[0]))) {
    const feet = count * RACEWAY_FT_PER_CIRCUIT;
    items.push({
      category: 'Conduit',
      description: 'EMT Conduit',
      quantity: Math.ceil(feet / 10), // 10' sticks
      unit: 'sticks',
      size: size === 'TBD' ? 'TBD' : `${size}"`,
      notes: size === 'TBD'
        ? `${plural(count, 'circuit')} not sized (conductor not in Chapter 9 tables)`
        : `${plural(count, 'circuit')} @ ~${RACEWAY_FT_PER_CIRCUIT}ft, 40% fill incl. EGC (NEC Ch. 9)`,
    });
  }

  return { items, warnings };
}
