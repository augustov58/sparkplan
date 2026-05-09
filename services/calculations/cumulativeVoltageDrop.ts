/**
 * Cumulative Voltage Drop Service
 *
 * Walks the panel hierarchy from a target panel UP toward the service, summing
 * per-segment VD% within the same voltage segment. Transformers reset the
 * count: cumulative VD only sums conductor runs that share a single voltage
 * base, since adding percentages across a voltage change is mathematically
 * meaningless (1% on 480V = 4.8V, but 4.8V on a 208V secondary is 2.3%).
 *
 * NEC 210.19(A)(1) IN No. 4 / 215.2(A)(1) IN No. 2 — recommended combined
 * feeder + branch ≤ 5%, branch alone ≤ 3%. The 5% guidance applies WITHIN a
 * voltage segment; NEC does not specify a method for cross-transformer chains.
 *
 * Pure function — no DB/hook side effects. Cached `voltage_drop_percent` from
 * the `feeders` table is used as the per-segment value. If a feeder is missing
 * its cached VD, the segment contributes 0 and a warning is added.
 */

import type { Database } from '../../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];

/**
 * Minimal feeder shape this service depends on. Keeping this as a structural
 * subset (rather than importing the DB Row or the types.ts interface) lets
 * both shapes be passed in without bridging — useful because the codebase
 * uses DB Row in some places and the types.ts Feeder in others.
 */
type Feeder = {
  id: string;
  name: string;
  source_panel_id: string | null;
  source_transformer_id: string | null;
  destination_panel_id: string | null;
  destination_transformer_id: string | null;
  is_service_entrance: boolean;
  voltage_drop_percent?: number | null;
};

export interface VoltageDropSegment {
  feederId: string;
  feederName: string;
  runPercent: number;             // this segment's VD%
  voltageBaseV: number;            // nominal voltage of this segment (downstream side)
  sourceLabel: string;             // 'Service' | panel name | `${transformer name} secondary`
  destinationLabel: string;        // panel name (or transformer name when feeder ends at one)
  isMissingData: boolean;          // true if voltage_drop_percent was null on the row
}

export interface CumulativeVoltageDropResult {
  perSegment: VoltageDropSegment[];
  cumulativePercent: number;       // sum of perSegment.runPercent (within current voltage segment)
  segmentCount: number;
  crossesTransformer: boolean;     // true if a transformer exists upstream of this voltage segment
  voltageSegmentBaseV: number;     // nominal voltage of the segment containing the target panel
  voltageSegmentSourceLabel: string; // 'Service Entrance' or `${transformer name} secondary`
  necReferences: string[];
  warnings: string[];
  breakdown: {
    targetPanelId: string;
    targetPanelName: string;
    incompleteSegments: number;
    chainLength: number;
  };
}

const NEC_REFS = [
  'NEC 210.19(A)(1) Informational Note No. 4 — recommended branch-circuit VD ≤ 3%',
  'NEC 215.2(A)(1) Informational Note No. 2 — recommended combined feeder + branch VD ≤ 5%',
];

/**
 * Walk upstream from a destination panel, building the chain of feeders that
 * carry power down into it within the current voltage segment.
 *
 * Returns segments ordered top-of-segment first (closest to source) → target.
 * Stops at:
 *   - a service-entrance feeder (top of utility-fed chain), OR
 *   - a transformer feed (top of post-transformer voltage segment), OR
 *   - a feeder whose source we can't resolve (orphan — emits a warning).
 *
 * A separate `crossesTransformer` flag is set if we hit a transformer; the
 * segment from the transformer secondary to the next downstream panel IS
 * included (it shares the new voltage base).
 */
function getUpstreamFeederChain(
  targetPanelId: string,
  panels: Panel[],
  feeders: Feeder[],
): { chain: Feeder[]; crossesTransformer: boolean; chainBrokenReason?: string } {
  const chain: Feeder[] = [];
  const visited = new Set<string>(); // cycle guard
  let crossesTransformer = false;
  let currentDestId: string | null = targetPanelId;
  let chainBrokenReason: string | undefined;

  while (currentDestId) {
    if (visited.has(currentDestId)) {
      chainBrokenReason = `Cycle detected at panel ${currentDestId}`;
      break;
    }
    visited.add(currentDestId);

    const incoming = feeders.find(
      (f) => f.destination_panel_id === currentDestId,
    );
    if (!incoming) {
      // No upstream feeder. If this is the MDP and there's no service-entrance
      // feeder yet, the chain just ends here (no warning — it's the expected
      // state pre-Phase 6).
      const dest = panels.find((p) => p.id === currentDestId);
      if (dest && !dest.is_main) {
        chainBrokenReason = `No incoming feeder found for panel '${dest.name}'`;
      }
      break;
    }

    chain.unshift(incoming);

    if (incoming.is_service_entrance) {
      break;
    }
    if (incoming.source_transformer_id) {
      crossesTransformer = true;
      break;
    }
    if (incoming.source_panel_id) {
      currentDestId = incoming.source_panel_id;
      continue;
    }

    chainBrokenReason = `Feeder '${incoming.name}' has no resolvable source`;
    break;
  }

  return { chain, crossesTransformer, chainBrokenReason };
}

/**
 * Resolve a friendly label for the source side of a feeder.
 */
function sourceLabel(
  feeder: Feeder,
  panels: Panel[],
  transformers: Transformer[],
): string {
  if (feeder.is_service_entrance) return 'Service';
  if (feeder.source_transformer_id) {
    const t = transformers.find((x) => x.id === feeder.source_transformer_id);
    return t ? `${t.name} secondary` : 'Transformer secondary';
  }
  if (feeder.source_panel_id) {
    const p = panels.find((x) => x.id === feeder.source_panel_id);
    return p?.name ?? 'Panel';
  }
  return 'Unknown';
}

function destinationLabel(
  feeder: Feeder,
  panels: Panel[],
  transformers: Transformer[],
): string {
  if (feeder.destination_panel_id) {
    const p = panels.find((x) => x.id === feeder.destination_panel_id);
    return p?.name ?? 'Panel';
  }
  if (feeder.destination_transformer_id) {
    const t = transformers.find((x) => x.id === feeder.destination_transformer_id);
    return t?.name ?? 'Transformer';
  }
  return 'Unknown';
}

/**
 * Calculate cumulative voltage drop for a single panel, walking up to the
 * nearest voltage source (service or transformer secondary).
 */
export function calculateCumulativeVoltageDrop(
  targetPanelId: string,
  panels: Panel[],
  feeders: Feeder[],
  transformers: Transformer[],
): CumulativeVoltageDropResult {
  const warnings: string[] = [];
  const target = panels.find((p) => p.id === targetPanelId);

  if (!target) {
    return emptyResult(targetPanelId, 'Unknown panel', [
      `Panel ${targetPanelId} not found`,
    ]);
  }

  const { chain, crossesTransformer, chainBrokenReason } =
    getUpstreamFeederChain(targetPanelId, panels, feeders);

  if (chainBrokenReason) {
    warnings.push(`INFO: ${chainBrokenReason}`);
  }

  // Build per-segment results.
  const perSegment: VoltageDropSegment[] = chain.map((feeder) => {
    const cachedPercent = feeder.voltage_drop_percent;
    const isMissingData = cachedPercent == null;
    const dest = panels.find((p) => p.id === feeder.destination_panel_id);
    return {
      feederId: feeder.id,
      feederName: feeder.name,
      runPercent: cachedPercent ?? 0,
      voltageBaseV: dest?.voltage ?? target.voltage,
      sourceLabel: sourceLabel(feeder, panels, transformers),
      destinationLabel: destinationLabel(feeder, panels, transformers),
      isMissingData,
    };
  });

  const incomplete = perSegment.filter((s) => s.isMissingData).length;
  if (incomplete > 0) {
    warnings.push(
      `WARNING: ${incomplete} of ${perSegment.length} segments missing cached voltage drop. Run feeder VD calculation to populate.`,
    );
  }

  const cumulativePercent = perSegment.reduce(
    (sum, s) => sum + s.runPercent,
    0,
  );

  // 5% combined threshold per NEC IN.
  if (cumulativePercent > 5) {
    warnings.push(
      `CRITICAL: Cumulative VD ${cumulativePercent.toFixed(2)}% exceeds NEC-recommended 5% feeder+branch limit at panel '${target.name}'.`,
    );
  } else if (cumulativePercent > 3) {
    warnings.push(
      `INFO: Cumulative VD ${cumulativePercent.toFixed(2)}% exceeds 3% target; check terminal-equipment voltage tolerance.`,
    );
  }

  // Determine the voltage-segment source label and base.
  const topSegment = perSegment[0];
  const voltageSegmentSourceLabel = topSegment
    ? topSegment.sourceLabel
    : 'Service';
  const voltageSegmentBaseV = topSegment?.voltageBaseV ?? target.voltage;

  if (crossesTransformer) {
    warnings.push(
      `INFO: Chain crosses a transformer; cumulative VD is summed only within '${voltageSegmentSourceLabel}' (NEC does not define cross-transformer % summation).`,
    );
  }

  return {
    perSegment,
    cumulativePercent: round2(cumulativePercent),
    segmentCount: perSegment.length,
    crossesTransformer,
    voltageSegmentBaseV,
    voltageSegmentSourceLabel,
    necReferences: NEC_REFS,
    warnings,
    breakdown: {
      targetPanelId: target.id,
      targetPanelName: target.name,
      incompleteSegments: incomplete,
      chainLength: perSegment.length,
    },
  };
}

/**
 * Resolve cumulative VD for the *endpoint* of a single feeder. Used by the
 * riser label, FeederManager card, and PDF report — all three need
 * "cumulative downstream of this feeder", not just "cumulative at this panel".
 *
 * Three cases:
 *   1. Destination is a panel → reuse the panel walker's result (panel-keyed map).
 *      Includes this feeder's VD% (the walker's chain ends with this feeder).
 *   2. Destination is a transformer primary, source is a panel → still in the
 *      same voltage segment as upstream, so cumulative = source-panel cumulative
 *      + this feeder's VD%.
 *   3. Destination is a transformer primary, source is a transformer (cascade) →
 *      cumulative resets at the upstream transformer secondary, so this feeder
 *      stands alone. Mark crossesTransformer so the label shows VD+*.
 *
 * Returns null when no meaningful cumulative can be computed (e.g. feeder has
 * no destination set, or the source panel isn't in the map).
 */
export function calculateCumulativeForFeeder(
  feeder: Feeder,
  panelCumulativeMap: Map<string, CumulativeVoltageDropResult>,
): { cumulativePercent: number; crossesTransformer: boolean } | null {
  const thisVD = feeder.voltage_drop_percent ?? 0;

  if (feeder.destination_panel_id) {
    const cum = panelCumulativeMap.get(feeder.destination_panel_id);
    if (!cum) return null;
    return {
      cumulativePercent: cum.cumulativePercent,
      crossesTransformer: cum.crossesTransformer,
    };
  }

  if (feeder.destination_transformer_id) {
    if (feeder.source_panel_id) {
      const sourceCum = panelCumulativeMap.get(feeder.source_panel_id);
      if (sourceCum) {
        return {
          cumulativePercent: round2(sourceCum.cumulativePercent + thisVD),
          crossesTransformer: sourceCum.crossesTransformer,
        };
      }
      return { cumulativePercent: round2(thisVD), crossesTransformer: false };
    }
    if (feeder.source_transformer_id) {
      // Cascaded transformers: cumulative restarts at the upstream secondary,
      // so this feeder stands alone. Asterisk-flag it.
      return { cumulativePercent: round2(thisVD), crossesTransformer: true };
    }
  }

  return null;
}

/**
 * Bulk calculate cumulative VD for every panel in a project. The riser diagram
 * uses this once per render to avoid recomputing in every panel-glyph call.
 */
export function calculateAllCumulativeVoltageDrops(
  panels: Panel[],
  feeders: Feeder[],
  transformers: Transformer[],
): Map<string, CumulativeVoltageDropResult> {
  const results = new Map<string, CumulativeVoltageDropResult>();
  for (const panel of panels) {
    results.set(
      panel.id,
      calculateCumulativeVoltageDrop(panel.id, panels, feeders, transformers),
    );
  }
  return results;
}

function emptyResult(
  panelId: string,
  panelName: string,
  warnings: string[],
): CumulativeVoltageDropResult {
  return {
    perSegment: [],
    cumulativePercent: 0,
    segmentCount: 0,
    crossesTransformer: false,
    voltageSegmentBaseV: 0,
    voltageSegmentSourceLabel: 'Service',
    necReferences: NEC_REFS,
    warnings,
    breakdown: {
      targetPanelId: panelId,
      targetPanelName: panelName,
      incompleteSegments: 0,
      chainLength: 0,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
