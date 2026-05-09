import { useMemo } from 'react';

import type { Database } from '../lib/database.types';
import type { Feeder } from '../types';
import {
  calculateAllCumulativeVoltageDrops,
  type CumulativeVoltageDropResult,
} from '../services/calculations/cumulativeVoltageDrop';

type Panel = Database['public']['Tables']['panels']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];
// Hook accepts the codebase's primary Feeder type (types.ts). The calc service
// uses a structural subset, so this is compatible.

/**
 * Pure derivation hook: given the project's panels/feeders/transformers,
 * returns a memoized Map<panelId, CumulativeVoltageDropResult>. The riser
 * diagram calls this once and looks up per-panel results during render so
 * we don't recompute the chain on every panel-glyph render.
 *
 * The memo key is the array of voltage_drop_percent values (the only field
 * that drives the cumulative result). This avoids invalidation churn when
 * unrelated panel/feeder fields update.
 */
export function useCumulativeVoltageDrop(
  panels: Panel[],
  feeders: Feeder[],
  transformers: Transformer[],
): Map<string, CumulativeVoltageDropResult> {
  const feederVdSignature = feeders
    .map((f) => `${f.id}:${f.voltage_drop_percent ?? 'null'}:${f.is_service_entrance}:${f.source_panel_id ?? ''}:${f.source_transformer_id ?? ''}:${f.destination_panel_id ?? ''}:${f.destination_transformer_id ?? ''}`)
    .join('|');
  const panelSignature = panels.map((p) => `${p.id}:${p.voltage}`).join('|');
  const transformerSignature = transformers.map((t) => `${t.id}:${t.name}`).join('|');

  return useMemo(
    () => calculateAllCumulativeVoltageDrops(panels, feeders, transformers),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional signature deps
    [feederVdSignature, panelSignature, transformerSignature],
  );
}

export type { CumulativeVoltageDropResult };
