/**
 * Short Circuit hierarchy resolution.
 *
 * Walks the panel/transformer feed chain (panel.fed_from_type discriminator +
 * the various fed_from_* FK columns) to find the correct *upstream* fault
 * current to feed into a downstream calculation.
 *
 * Why this exists
 * ---------------
 * The point-to-point method (Bussmann/Eaton SPD page 237-238) requires the
 * source If at each fault location to be the IMMEDIATE upstream level's
 * fault current — not the service entrance value. For a chain like
 *
 *     MDP → Sub-Panel A → Sub-Sub-Panel B
 *
 * B's calculation should use A's saved fault current as the source, not the
 * service entrance's. Without that walk, B's If is dramatically over-estimated
 * (the conductor impedance from MDP→A is ignored).
 *
 * Transformers mid-chain add a wrinkle: when the parent is a transformer, the
 * source If has to first pass through the transformer's impedance via the
 * SPD-237 secondary-from-primary formula. That's handled by
 * `calculateDownstreamTransformerFaultCurrent` in the engine.
 *
 * This module is a PURE function — no DB, no hooks, no side effects. The UI
 * passes in already-loaded panels/transformers/calculations and gets back a
 * structured upstream resolution.
 */

import type { Database } from '../../lib/database.types';
import { calculateDownstreamTransformerFaultCurrent } from './shortCircuit';

type Panel = Database['public']['Tables']['panels']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type ShortCircuitCalculation = Database['public']['Tables']['short_circuit_calculations']['Row'];

/**
 * Result of walking up the feed chain from a target panel.
 */
export interface UpstreamSourceResolution {
  /** Source If (amperes) to feed into the target panel's downstream calc. */
  sourceFaultCurrent: number;
  /**
   * Human-readable chain, ordered from immediate parent → root.
   * Example: ['Sub-Panel A', '25 kVA Xfmr T-1', 'MDP'].
   */
  upstreamChain: string[];
  /**
   * True when every link in the chain has a saved SC calc backing it.
   * False when an upstream panel/transformer hasn't been calculated yet —
   * the UI should warn before saving.
   */
  isComplete: boolean;
  /** Soft warnings (missing calc, unsupported parent type, etc.). */
  warnings: string[];
}

interface ResolveDeps {
  project: Pick<
    Project,
    'service_voltage' | 'service_phase' | 'utility_available_fault_current_a'
  >;
  panels: Panel[];
  transformers: Transformer[];
  calculations: ShortCircuitCalculation[];
}

const FALLBACK_FAULT_CURRENT_A = 10_000;

function getServiceCalcIf(calculations: ShortCircuitCalculation[]): number | null {
  const svc = calculations.find((c) => c.calculation_type === 'service' && !c.panel_id);
  const raw = (svc?.results as any)?.faultCurrent;
  return typeof raw === 'number' && raw > 0 ? raw : null;
}

/**
 * Best-available "service-level" fault current with priority:
 *   1. saved service-entrance calc
 *   2. project's recorded utility AFC
 *   3. 10 kA fallback
 * Returns a tagged result so every caller surfaces the right warning.
 */
function resolveServiceLevelIf(
  calculations: ShortCircuitCalculation[],
  project: ResolveDeps['project'],
): { value: number; isComplete: boolean; warning: string | null } {
  const svc = getServiceCalcIf(calculations);
  if (svc !== null) return { value: svc, isComplete: true, warning: null };
  if (
    project.utility_available_fault_current_a &&
    project.utility_available_fault_current_a > 0
  ) {
    return {
      value: project.utility_available_fault_current_a,
      isComplete: false,
      warning: 'Service-entrance calc not yet saved. Using project utility AFC.',
    };
  }
  return {
    value: FALLBACK_FAULT_CURRENT_A,
    isComplete: false,
    warning: 'No service-entrance calc and no project utility AFC. Result uses a 10 kA default.',
  };
}

function getPanelCalcIf(
  panelId: string,
  calculations: ShortCircuitCalculation[],
): number | null {
  const calc = calculations.find((c) => c.panel_id === panelId);
  const raw = (calc?.results as any)?.faultCurrent;
  return typeof raw === 'number' && raw > 0 ? raw : null;
}

/**
 * Resolve the upstream source If for the given target panel by walking the
 * feed chain.
 *
 * Resolution rules (in priority order):
 *   1. target.is_main === true  → use service-entrance calc (or project's
 *      recorded utility AFC, or 10 kA fallback). Note: a downstream-mode
 *      calc on the MDP should normally be blocked by the UI; this branch is
 *      defensive.
 *   2. target.fed_from_type === 'panel'  → parent is a panel. Source If is
 *      that parent panel's saved SC calc. If absent, return service If with
 *      a "chain incomplete" warning (chain is broken until the user
 *      calculates the parent first).
 *   3. target.fed_from_type === 'transformer'  → parent is a transformer.
 *      Find its primary-side If (the upstream panel feeding the transformer),
 *      then pass through `calculateDownstreamTransformerFaultCurrent` to get
 *      the secondary-side If. If the upstream panel isn't calculated yet,
 *      the chain is incomplete.
 *   4. target.fed_from_type === 'service' (or null discriminator + no other
 *      hint) → use service-entrance calc.
 */
export function resolveUpstreamSourceIf(
  target: Panel,
  deps: ResolveDeps,
): UpstreamSourceResolution {
  const { project, panels, transformers, calculations } = deps;
  const warnings: string[] = [];
  const upstreamChain: string[] = [];

  // Defensive: the MDP shouldn't be calculated as a downstream panel, but if
  // it is, surface the service-level If.
  if (target.is_main) {
    const svc = resolveServiceLevelIf(calculations, project);
    upstreamChain.push(svc.isComplete ? 'Service Entrance' : 'Service Entrance (not calculated)');
    if (svc.warning) warnings.push(svc.warning);
    return {
      sourceFaultCurrent: svc.value,
      upstreamChain,
      isComplete: svc.isComplete,
      warnings,
    };
  }

  const fedFromType = target.fed_from_type;

  if (fedFromType === 'panel' && target.fed_from) {
    const parent = panels.find((p) => p.id === target.fed_from);
    if (!parent) {
      warnings.push(`Parent panel (id=${target.fed_from}) not found in project.`);
      return {
        sourceFaultCurrent: FALLBACK_FAULT_CURRENT_A,
        upstreamChain: ['(unknown parent)'],
        isComplete: false,
        warnings,
      };
    }
    upstreamChain.push(parent.name);
    // If the parent is itself a downstream panel, we don't recursively walk
    // further — the parent's saved calc already encodes its own upstream
    // chain. We just consume it.
    const parentIf = getPanelCalcIf(parent.id, calculations);
    if (parentIf !== null) {
      return { sourceFaultCurrent: parentIf, upstreamChain, isComplete: true, warnings };
    }
    // Parent panel is the MDP — the service calc IS its short-circuit calc.
    if (parent.is_main) {
      const svc = resolveServiceLevelIf(calculations, project);
      if (svc.warning) warnings.push(svc.warning);
      return {
        sourceFaultCurrent: svc.value,
        upstreamChain,
        isComplete: svc.isComplete,
        warnings,
      };
    }
    warnings.push(
      `Upstream panel "${parent.name}" has no saved SC calc — calculate it first for an accurate chain.`,
    );
    const fallback = resolveServiceLevelIf(calculations, project);
    return {
      sourceFaultCurrent: fallback.value,
      upstreamChain,
      isComplete: false,
      warnings,
    };
  }

  if (fedFromType === 'transformer' && target.fed_from_transformer_id) {
    const xfmr = transformers.find((t) => t.id === target.fed_from_transformer_id);
    if (!xfmr) {
      warnings.push(`Transformer (id=${target.fed_from_transformer_id}) not found in project.`);
      return {
        sourceFaultCurrent: FALLBACK_FAULT_CURRENT_A,
        upstreamChain: ['(unknown transformer)'],
        isComplete: false,
        warnings,
      };
    }
    upstreamChain.push(`${xfmr.kva_rating} kVA — ${xfmr.name}`);

    // Find the transformer's primary-side If — the panel feeding it.
    let primaryIf: number | null = null;
    if (xfmr.fed_from_panel_id) {
      const primaryPanel = panels.find((p) => p.id === xfmr.fed_from_panel_id);
      if (primaryPanel) {
        upstreamChain.push(primaryPanel.name);
        if (primaryPanel.is_main) {
          primaryIf = getServiceCalcIf(calculations);
        } else {
          primaryIf = getPanelCalcIf(primaryPanel.id, calculations);
        }
      }
    } else {
      // Transformer fed directly from the service entrance (no intermediate panel).
      primaryIf = getServiceCalcIf(calculations);
      upstreamChain.push('Service Entrance');
    }

    if (primaryIf === null) {
      warnings.push(
        `Upstream of transformer "${xfmr.name}" has no saved SC calc — calculate it first. Falling back to service-entrance value.`,
      );
      primaryIf = getServiceCalcIf(calculations) ?? FALLBACK_FAULT_CURRENT_A;
      const xfmrResult = calculateDownstreamTransformerFaultCurrent(
        {
          kva: xfmr.kva_rating,
          primaryVoltage: xfmr.primary_voltage,
          secondaryVoltage: target.voltage || xfmr.primary_voltage,
          impedance: xfmr.impedance_percent ?? 5.75,
        },
        primaryIf,
        (xfmr.primary_phase === 3 ? 3 : 1) as 1 | 3,
      );
      return {
        sourceFaultCurrent: xfmrResult.faultCurrent,
        upstreamChain,
        isComplete: false,
        warnings,
      };
    }

    const xfmrResult = calculateDownstreamTransformerFaultCurrent(
      {
        kva: xfmr.kva_rating,
        primaryVoltage: xfmr.primary_voltage,
        secondaryVoltage: target.voltage || xfmr.primary_voltage,
        impedance: xfmr.impedance_percent ?? 5.75,
      },
      primaryIf,
      (xfmr.primary_phase === 3 ? 3 : 1) as 1 | 3,
    );
    return {
      sourceFaultCurrent: xfmrResult.faultCurrent,
      upstreamChain,
      isComplete: true,
      warnings,
    };
  }

  // fed_from_type === 'service' OR null OR meter_stack — treat as service-fed.
  const svc = resolveServiceLevelIf(calculations, project);
  upstreamChain.push(svc.isComplete ? 'Service Entrance' : 'Service Entrance (not calculated)');
  if (svc.warning) warnings.push(svc.warning);
  return {
    sourceFaultCurrent: svc.value,
    upstreamChain,
    isComplete: svc.isComplete,
    warnings,
  };
}

/**
 * Detect which saved panel calcs are stale because their stored source If
 * disagrees with the currently-resolvable upstream value.
 *
 * Tolerance: 1 amp. Anything smaller is rounding noise from the calc engine.
 *
 * Returns a map of `panel_calc.id → reason`. A calc not in the map is fresh.
 */
export function detectStaleCalculations(
  deps: ResolveDeps,
): Map<string, { storedIf: number; expectedIf: number; reason: string }> {
  const stale = new Map<string, { storedIf: number; expectedIf: number; reason: string }>();
  const panelCalcs = deps.calculations.filter(
    (c) => c.calculation_type === 'panel' || (c.calculation_type === 'service' && c.panel_id),
  );

  for (const calc of panelCalcs) {
    if (!calc.panel_id || typeof calc.source_fault_current !== 'number') continue;
    const target = deps.panels.find((p) => p.id === calc.panel_id);
    if (!target) continue;

    const resolved = resolveUpstreamSourceIf(target, deps);
    const drift = Math.abs(resolved.sourceFaultCurrent - calc.source_fault_current);
    if (drift > 1) {
      stale.set(calc.id, {
        storedIf: calc.source_fault_current,
        expectedIf: resolved.sourceFaultCurrent,
        reason: `Upstream chain changed: was ${Math.round(calc.source_fault_current).toLocaleString()} A, now ${Math.round(resolved.sourceFaultCurrent).toLocaleString()} A`,
      });
    }
  }
  return stale;
}
