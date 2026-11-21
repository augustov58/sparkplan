/**
 * A feeder's own breaker (owner ruling 2026-11-21, #283, option b).
 *
 * The breaker is stored on the destination panel (`panels.feeder_breaker_amps`)
 * and written when the feeder is sized; the feeder form can edit it. Until it
 * is written, it defaults by the feeder's sizing basis: "Calculated Load" →
 * the next standard size at or above the design current; "Panel Max Capacity"
 * → the panel's main breaker. A feeder to a transformer keeps the
 * transformer's primary breaker. Every reader (the panel schedule's feeder
 * row, the packet's feeder rows, Feeder Sizing, Inspector Mode, the stale
 * check) asks this module, so they can't disagree.
 *
 * The conductors carry the design load and are protected by that breaker
 * (240.4, incl. (B)); the EGC comes from it (Table 250.122). A feeder whose
 * stored conductor isn't protected, or whose design current exceeds the
 * breaker, is Outdated.
 *
 * Pure: no DB, no hooks.
 */
import { getNextStandardBreakerSize } from '../../data/nec/standard-breakers';
import { getEgcSize } from '../../data/nec/table-250-122';
import { conductorCodeLegal } from '../../data/nec/table-310-16';

export type FeederSizingBasis = 'load' | 'capacity';

export interface FeederBreakerPanel {
  voltage: number;
  phase: number;
  main_breaker_amps: number | null;
  bus_rating: number | null;
  feeder_breaker_amps: number | null;
}

export interface FeederBreakerFeeder {
  sizing_basis?: string | null;
  design_load_va?: number | null;
  phase_conductor_size?: string | null;
  conductor_material?: string | null;
  sets_in_parallel?: number | null;
  destination_transformer_id?: string | null;
  destination_panel_id?: string | null;
}

/** A feeder's basis; a feeder sized before the column existed reads as 'load' (what Recalculate always used). */
export function feederSizingBasis(feeder: FeederBreakerFeeder | null | undefined): FeederSizingBasis {
  return feeder?.sizing_basis === 'capacity' ? 'capacity' : 'load';
}

/** Design current at the destination panel's voltage and phase. */
export function feederDesignCurrentA(designLoadVA: number, panel: Pick<FeederBreakerPanel, 'voltage' | 'phase'>): number {
  if (!designLoadVA || !panel.voltage) return 0;
  return panel.phase === 3 ? designLoadVA / (Math.sqrt(3) * panel.voltage) : designLoadVA / panel.voltage;
}

/** The breaker a feeder gets when it is sized and none was entered. */
export function defaultFeederBreakerAmps(
  basis: FeederSizingBasis,
  panel: FeederBreakerPanel,
  designCurrentA: number,
): number | null {
  if (basis === 'capacity') return panel.main_breaker_amps || panel.bus_rating || null;
  return designCurrentA > 0 ? getNextStandardBreakerSize(designCurrentA) : null;
}

/**
 * The feeder's breaker, for every reader. `feeder` is the feeder ending at
 * `panel` (or undefined when none is drawn: then the panel's main breaker, as
 * before #283).
 */
export function feederBreakerAmps(args: {
  panel?: FeederBreakerPanel | null;
  feeder?: FeederBreakerFeeder | null;
  transformer?: { primary_breaker_amps?: number | null } | null;
}): number | null {
  const { panel, feeder, transformer } = args;
  if (transformer || feeder?.destination_transformer_id) return transformer?.primary_breaker_amps ?? null;
  if (!panel) return null;
  if (panel.feeder_breaker_amps) return panel.feeder_breaker_amps;
  if (feeder) {
    const fallback = defaultFeederBreakerAmps(
      feederSizingBasis(feeder), panel, feederDesignCurrentA(feeder.design_load_va ?? 0, panel),
    );
    if (fallback) return fallback;
  }
  return panel.main_breaker_amps || panel.bus_rating || null;
}

/** Table 250.122 EGC for the feeder's breaker. */
export function feederEgcSize(breakerAmps: number, material: 'Cu' | 'Al'): string {
  return getEgcSize(breakerAmps, material);
}

/**
 * Why a sized feeder is Outdated against its breaker (#283): the stored phase
 * conductor isn't protected by it (240.4 incl. (B)), or the design current
 * exceeds it. Empty when consistent or not yet sized.
 */
export function feederBreakerReasons(feeder: FeederBreakerFeeder, breakerAmps: number | null, designCurrentA: number): string[] {
  const reasons: string[] = [];
  if (!breakerAmps || !feeder.phase_conductor_size) return reasons;
  if (designCurrentA > breakerAmps) {
    reasons.push(`Design current ${designCurrentA.toFixed(1)} A exceeds the ${breakerAmps} A feeder breaker`);
  }
  const material = feeder.conductor_material === 'Al' ? 'Al' : 'Cu';
  const sets = Math.max(1, feeder.sets_in_parallel ?? 1);
  const check = conductorCodeLegal({ conductor: feeder.phase_conductor_size, material, breakerAmps, sets });
  if (!check.legal) {
    reasons.push(
      `${sets > 1 ? `${sets} × ` : ''}${feeder.phase_conductor_size} ${material} (${check.ampacityA} A at ${check.terminationC} °C) ` +
      `is not protected by the ${breakerAmps} A feeder breaker (NEC 240.4)`,
    );
  }
  return reasons;
}

/**
 * The breaker to size a feeder against when re-computing it from stored data
 * (the packet's voltage-drop page, the Copilot): a transformer's primary
 * breaker; the stored feeder breaker; for "Panel Max Capacity" the panel's
 * main breaker; otherwise undefined, so `calculateFeederSizing` takes the next
 * standard size at or above the design current it computes.
 */
export function feederOcpdForSizing(args: {
  panel?: FeederBreakerPanel | null;
  feeder?: FeederBreakerFeeder | null;
  transformer?: { primary_breaker_amps?: number | null } | null;
}): number | undefined {
  const { panel, feeder, transformer } = args;
  if (transformer || feeder?.destination_transformer_id) return transformer?.primary_breaker_amps || undefined;
  if (!panel) return undefined;
  if (panel.feeder_breaker_amps) return panel.feeder_breaker_amps;
  if (feederSizingBasis(feeder) === 'capacity') return panel.main_breaker_amps || panel.bus_rating || undefined;
  return undefined;
}
