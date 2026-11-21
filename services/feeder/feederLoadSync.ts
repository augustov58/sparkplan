/**
 * Feeder Load Synchronization Service
 * 
 * Tracks when feeder calculations become stale due to changes in
 * downstream panel loads. Provides utilities for detecting and
 * handling load updates.
 * 
 * @module services/feeder/feederLoadSync
 * 
 * Issue: Once a feeder is created between 2 panels, it should also update
 * if the load is changed in the panel later on - or at least show a notification.
 */

import type { Feeder } from '@/types';
import type { Database } from '@/lib/database.types';
import {
  calculateAggregatedLoad,
  continuousLoadVA,
  isEVEMSMarkerCircuit,
  type DwellingAggregateOptions,
} from '@/services/calculations/upstreamLoadAggregation';
import { CONTINUOUS_LOAD_FACTOR } from '@/data/nec/continuous-load';
import { calculateVoltageDropAC } from '@/services/calculations/voltageDrop';
import { feederBreakerAmps, feederBreakerReasons, feederDesignCurrentA, feederSizingBasis } from '@/services/feeder/feederBreaker';
import type { NecEdition } from '@/data/nec/evse-load';

type Circuit = Database['public']['Tables']['circuits']['Row'];
type Panel = Database['public']['Tables']['panels']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];
type Occupancy = 'dwelling' | 'commercial' | 'industrial';

/** A stored design load this far from the current rule's flags the feeder (#190). */
const DESIGN_LOAD_STALE_FRACTION = 0.01;
/** A stored voltage drop this far (percentage points) from the formula's is outdated (#219) */
const VD_STALE_PERCENT_POINTS = 0.02;

export interface FeederLoadStatus {
  feederId: string;
  feederName: string;
  destinationPanelId: string;
  destinationPanelName?: string;
  isStale: boolean;
  currentConnectedVA: number;
  cachedConnectedVA: number;
  loadDifferenceVA: number;
  loadDifferencePercent: number;
  /** True when the stored design load differs from what the sizing rule now gives (#190) */
  designChanged: boolean;
  cachedDesignVA: number;
  currentDesignVA: number;
  /** True when the stored voltage drop differs from what the formula now gives (#219) */
  vdChanged?: boolean;
  cachedVdPercent?: number;
  currentVdPercent?: number;
  /** #283: why the feeder is Outdated against its breaker (240.4 / design current); empty when consistent. */
  breakerReasons?: string[];
  message: string;
}

/** What the stale check needs to recompute a feeder's design load the way the Feeder Manager does */
export interface FeederDesignContext {
  transformers: Transformer[];
  occupancy: Occupancy;
  necEdition: NecEdition;
  /** Dwelling projects: unit / house panel rules (#179); `dwellingAggregateOptions(project)`. */
  dwelling?: DwellingAggregateOptions;
}

/**
 * Calculates the current CONNECTED load for a panel from its direct circuits
 * (Not demand - just simple sum for comparison purposes)
 */
function calculatePanelCurrentConnectedLoad(
  panelId: string,
  circuits: Circuit[]
): number {
  return circuits
    .filter(c => c.panel_id === panelId && !isEVEMSMarkerCircuit(c))
    .reduce((sum, c) => sum + (c.load_watts || 0), 0);
}

/**
 * Checks if a feeder's cached load values are stale compared to current panel loads
 * 
 * Note: This compares CONNECTED loads for simplicity. The actual demand calculation
 * happens in upstreamLoadAggregation.ts when the feeder is recalculated.
 * 
 * IMPORTANT: This only applies to feeders sized based on calculated load.
 * Feeders sized based on panel max capacity are never considered stale
 * (since they're sized for full capacity regardless of actual load).
 * 
 * @param feeder - The feeder to check
 * @param circuits - All circuits in the project
 * @param panels - All panels (to check if feeder was capacity-based)
 * @param thresholdPercent - Percentage difference to consider stale (default 5%)
 * @returns FeederLoadStatus with details about staleness
 */
export function checkFeederLoadStatus(
  feeder: Feeder,
  circuits: Circuit[],
  panels?: Panel[],
  thresholdPercent: number = 5,
  /** When given, also flag a stored design load that the sizing rule no longer gives (#190) */
  design?: FeederDesignContext,
): FeederLoadStatus {
  // Only check feeders that go to panels (not transformers)
  if (!feeder.destination_panel_id) {
    return {
      feederId: feeder.id,
      feederName: feeder.name,
      destinationPanelId: '',
      isStale: false,
      currentConnectedVA: 0,
      cachedConnectedVA: 0,
      loadDifferenceVA: 0,
      loadDifferencePercent: 0,
      designChanged: false,
      cachedDesignVA: 0,
      currentDesignVA: 0,
      message: 'Feeder to transformer - load sync N/A',
    };
  }

  // #283: the feeder's own breaker. Outdated when its stored conductor isn't
  // protected by it (240.4 incl. (B)) or the design current exceeds it.
  const destPanel = panels?.find(p => p.id === feeder.destination_panel_id);
  const breakerReasons = destPanel
    ? feederBreakerReasons(
        feeder,
        feederBreakerAmps({ panel: destPanel, feeder }),
        feederDesignCurrentA(feeder.design_load_va || 0, destPanel),
      )
    : [];

  // A feeder sized for the panel's max capacity isn't affected by load changes.
  // Its basis is stored (feeders.sizing_basis), not guessed from its load (#283).
  if (feederSizingBasis(feeder) === 'capacity') {
    const outdated = breakerReasons.length > 0;
    return {
      feederId: feeder.id,
      feederName: feeder.name,
      destinationPanelId: feeder.destination_panel_id,
      isStale: outdated,
      currentConnectedVA: 0,
      cachedConnectedVA: feeder.total_load_va || 0,
      loadDifferenceVA: 0,
      loadDifferencePercent: 0,
      designChanged: false,
      cachedDesignVA: 0,
      currentDesignVA: 0,
      breakerReasons,
      message: outdated
        ? `${breakerReasons.join('; ')} - recalculation recommended`
        : 'Feeder sized for panel max capacity - not affected by load changes',
    };
  }

  const currentConnected = calculatePanelCurrentConnectedLoad(feeder.destination_panel_id, circuits);
  const cachedConnected = feeder.total_load_va || 0;

  const difference = Math.abs(currentConnected - cachedConnected);
  const percentDiff = cachedConnected > 0 
    ? (difference / cachedConnected) * 100 
    : (currentConnected > 0 ? 100 : 0);

  // #190: the stored design load against the one the current rule gives. A
  // rule change (or an EVEMS marker, which adds no connected load) moves it
  // without moving the connected load. 1%, not 5%: an all-EV feeder going
  // from 1.20 to 1.25 × demand moves 4.2%.
  const cachedDesignVA = feeder.design_load_va || 0;
  const currentDesignVA = design && panels && cachedDesignVA > 0
    ? feederDesignLoadVA(feeder.destination_panel_id, panels, circuits, design)
    : cachedDesignVA;
  const designChanged = cachedDesignVA > 0 &&
    Math.abs(currentDesignVA - cachedDesignVA) / cachedDesignVA > DESIGN_LOAD_STALE_FRACTION;

  // #219: the stored voltage drop against the formula now (Table 9 Note 2
  // effective Z; √3 on three-phase), for the stored conductor and design
  // load, as calculateFeederSizing computes it. Panel-fed feeders only.
  const sourcePanel = panels?.find(p => p.id === feeder.source_panel_id);
  const cachedVdPercent = feeder.voltage_drop_percent;
  let currentVdPercent: number | undefined;
  if (sourcePanel && !feeder.source_transformer_id && feeder.phase_conductor_size && feeder.distance_ft
    && cachedDesignVA > 0 && typeof cachedVdPercent === 'number') {
    const phase: 1 | 3 = sourcePanel.phase === 1 ? 1 : 3;
    const voltage = sourcePanel.voltage || 240;
    const amps = cachedDesignVA / (voltage * (phase === 3 ? Math.sqrt(3) : 1)) / Math.max(1, feeder.sets_in_parallel || 1);
    const vd = calculateVoltageDropAC(
      feeder.phase_conductor_size, feeder.conductor_material === 'Al' ? 'Al' : 'Cu', 'PVC',
      feeder.distance_ft, amps, voltage, phase,
    );
    if (vd.effectiveZ > 0) currentVdPercent = vd.voltageDropPercent;
  }
  const vdChanged = currentVdPercent !== undefined && typeof cachedVdPercent === 'number'
    && Math.abs(currentVdPercent - cachedVdPercent) > VD_STALE_PERCENT_POINTS;

  const isStale = percentDiff > thresholdPercent || designChanged || vdChanged || breakerReasons.length > 0;

  let message = '';
  if (breakerReasons.length > 0) {
    message = `${breakerReasons.join('; ')} - recalculation recommended`;
  } else if (vdChanged && !designChanged && percentDiff <= thresholdPercent) {
    message = `Voltage drop ${cachedVdPercent!.toFixed(2)}% → ${currentVdPercent!.toFixed(2)}% - recalculation recommended`;
  } else if (designChanged && percentDiff <= thresholdPercent) {
    message = `Design load ${(cachedDesignVA / 1000).toFixed(1)} → ${(currentDesignVA / 1000).toFixed(1)} kVA - recalculation recommended`;
  } else if (isStale) {
    if (currentConnected > cachedConnected) {
      message = `Load increased by ${difference.toLocaleString()} VA (${percentDiff.toFixed(1)}%) - recalculation recommended`;
    } else {
      message = `Load decreased by ${difference.toLocaleString()} VA (${percentDiff.toFixed(1)}%) - recalculation recommended`;
    }
  } else {
    message = 'Feeder sizing is current';
  }

  return {
    feederId: feeder.id,
    feederName: feeder.name,
    destinationPanelId: feeder.destination_panel_id,
    isStale,
    currentConnectedVA: currentConnected,
    cachedConnectedVA: cachedConnected,
    loadDifferenceVA: difference,
    loadDifferencePercent: Math.round(percentDiff * 10) / 10,
    designChanged,
    breakerReasons,
    cachedDesignVA,
    currentDesignVA: Math.round(currentDesignVA),
    vdChanged,
    cachedVdPercent: typeof cachedVdPercent === 'number' ? cachedVdPercent : undefined,
    currentVdPercent,
    message,
  };
}

/**
 * Gets all stale feeders for a project
 * Note: Feeders sized for panel max capacity are excluded (never stale)
 */
export function getStaleFeedersList(
  feeders: Feeder[],
  circuits: Circuit[],
  panels?: Panel[],
  thresholdPercent: number = 5,
  design?: FeederDesignContext,
): FeederLoadStatus[] {
  return feeders
    .map(feeder => checkFeederLoadStatus(feeder, circuits, panels, thresholdPercent, design))
    .filter(status => status.isStale);
}

/**
 * Gets feeders that need recalculation because a specific panel's load changed
 */
export function getFeedersAffectedByPanelChange(
  panelId: string,
  feeders: Feeder[]
): Feeder[] {
  return feeders.filter(f => f.destination_panel_id === panelId);
}

/**
 * Live-derive a feeder's load VA from its destination panel's aggregated demand.
 *
 * Use this in any READ path (PDF generators, gating helpers, UI displays) that needs
 * up-to-date values rather than the cached snapshot stored in `feeder.total_load_va`.
 * Writers (FeederManager.handleRecalculateFeeder, etc.) keep persisting the cached
 * value so future PE-seal workflows can snapshot a "as-of-seal-time" load.
 *
 * Returns NEC-220-demand VA (post-cascade), per NEC 215.2(A)(1) which sizes feeders
 * to "the noncontinuous load + 125% of the continuous load" — and "load" in NEC
 * means demand load with per-load-type DFs already applied.
 *
 * Intentionally does NOT pass `multiFamilyContext` — NEC 220.84 is the system-aggregate
 * Optional Method that applies only at the MDP service level, never per-feeder.
 *
 * Falls back to the cached value when:
 *  - feeder has no `destination_panel_id` (transformer feeders size from xfmr kVA)
 *  - destination panel can't be found (data integrity issue, defensive)
 */
export function computeFeederLoadVA(
  feeder: Feeder,
  panels: Panel[],
  circuits: Circuit[],
  transformers: Transformer[],
  /** EVSE load rule (NEC 2023 220.57 floor); the project's `resolveNecEdition`. */
  necEdition: NecEdition = '2020',
  /** The project's occupancy, as the Feeder Manager sizes it (#179). */
  occupancy: Occupancy = 'commercial',
  dwelling?: DwellingAggregateOptions,
): number {
  if (!feeder.destination_panel_id) {
    return feeder.total_load_va || 0;
  }
  const destPanel = panels.find(p => p.id === feeder.destination_panel_id);
  if (!destPanel) {
    return feeder.total_load_va || 0;
  }
  const aggregate = calculateAggregatedLoad(
    feeder.destination_panel_id,
    panels,
    circuits,
    transformers,
    occupancy,
    undefined,
    necEdition,
    dwelling,
  );
  return aggregate.totalDemandVA;
}

/**
 * Feeder design load split — NEC 215.2(A)(1), 215.3 and 625.41 (PE ruling
 * 2026-11-17, #190): the feeder's Article 220 demand at 100%, with its
 * continuous loads (`continuousLoadVA`: EV charging, signs, show windows; an
 * EVEMS panel's chargers at the setpoint) as the continuous part.
 * `calculateFeederSizing` takes that part at 125%, so the design load is the
 * demand plus 25% of the continuous loads. Replaces a blanket 80% / 20% split
 * (design = 1.20 × demand) that undersized all-EV feeders and oversized the
 * rest. One definition for the Feeder Manager, the packet's E-103 and the
 * Copilot, the same classifier as the service check (#192).
 *
 * @param rootPanelIds - the destination panel, or the panels a destination
 *   transformer feeds; each counts with everything downstream of it
 * @param demandVA - the feeder's Article 220 demand; the continuous part is
 *   capped at it
 */
export function feederDesignLoadSplit(
  rootPanelIds: string[],
  demandVA: number,
  panels: Panel[],
  circuits: Circuit[],
  transformers: Transformer[],
  necEdition: NecEdition,
): { continuousVA: number; noncontinuousVA: number } {
  const demand = Math.max(0, demandVA);
  const continuousTotalVA = rootPanelIds.reduce((total, panelId) => {
    const { existingVA, proposedVA } = continuousLoadVA(panelId, panels, circuits, transformers, necEdition);
    return total + existingVA + proposedVA;
  }, 0);
  const continuousVA = Math.min(continuousTotalVA, demand);
  return { continuousVA, noncontinuousVA: demand - continuousVA };
}

/**
 * The design load the current rule gives a feeder to `destinationPanelId`,
 * computed as the Feeder Manager does: the destination's aggregate demand for
 * the project's occupancy, plus 25% of its continuous loads.
 */
export function feederDesignLoadVA(
  destinationPanelId: string,
  panels: Panel[],
  circuits: Circuit[],
  design: FeederDesignContext,
): number {
  const demandVA = calculateAggregatedLoad(
    destinationPanelId, panels, circuits, design.transformers, design.occupancy, undefined, design.necEdition, design.dwelling,
  ).totalDemandVA;
  const { continuousVA, noncontinuousVA } = feederDesignLoadSplit(
    [destinationPanelId], demandVA, panels, circuits, design.transformers, design.necEdition,
  );
  return continuousVA * CONTINUOUS_LOAD_FACTOR + noncontinuousVA;
}
