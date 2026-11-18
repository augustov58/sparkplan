/**
 * #218: Table 220.42 has no "office" row. Its catch-all row is "All others"
 * (total VA at 100%), which offices, stores, industrial projects and common
 * areas fall under. The value (100%) is unchanged; the label was wrong. The
 * hotel / warehouse / store rows await a code-book check (#236), so this pins
 * only the row that's read for non-dwelling occupancies.
 */
import { describe, it, expect } from 'vitest';
import { TABLE_220_42, getLightingDemandFactor } from '../data/nec/table-220-42';
import { calculateAggregatedLoad } from '../services/calculations/upstreamLoadAggregation';
import { calculateLoad } from '../services/calculations/loadCalculation';
import type { Database } from '../lib/database.types';
import type { LoadItem, ProjectSettings } from '../types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];

const ALL_OTHERS = 'Table 220.42 (All others)';

describe('#218 Table 220.42 "All others" row', () => {
  it('is 100% of the total and cites "All others"; no row is called office', () => {
    expect(getLightingDemandFactor('all_others', 250_000)).toEqual({
      demandVA: 250_000, demandFactor: 1, necReference: ALL_OTHERS,
    });
    expect(TABLE_220_42.map(r => r.necReference).join(' ')).not.toMatch(/office/i);
  });

  it('the Part III aggregate cites it for a commercial panel (QA Commercial panel: 3,000 VA lighting)', () => {
    const mdp = { id: 'mdp', name: 'MDP', is_main: true, fed_from: null, fed_from_type: 'service',
      voltage: 208, phase: 3, bus_rating: 200, main_breaker_amps: 200, project_id: 'p' } as unknown as Panel;
    const lighting = { id: 'c1', panel_id: 'mdp', description: 'Lighting', load_type: 'L', load_watts: 3_000,
      breaker_amps: 20, pole: 1, circuit_number: 1, project_id: 'p' } as unknown as Circuit;
    const row = calculateAggregatedLoad('mdp', [mdp], [lighting], [], 'commercial', undefined, '2020')
      .demandBreakdown.find(r => r.loadType === 'Lighting');
    expect(row).toMatchObject({ connectedVA: 3_000, demandVA: 3_000, demandFactor: 1, necReference: ALL_OTHERS });
  });

  it('the legacy Load Calculator: commercial and industrial both read "All others", not a warehouse', () => {
    const loads: LoadItem[] = [{ id: 'l', description: 'Lighting', watts: 20_000, type: 'lighting', continuous: false, phase: 'A' }];
    for (const occupancyType of ['commercial', 'industrial'] as const) {
      const settings = { serviceVoltage: 208, servicePhase: 3, occupancyType, conductorMaterial: 'Cu', temperatureRating: 75 } as ProjectSettings;
      const refs = calculateLoad(loads, settings).necReferences.join(' | ');
      expect(refs).toContain(ALL_OTHERS);
      expect(refs).not.toMatch(/Warehouse|Office/);
    }
  });
});
