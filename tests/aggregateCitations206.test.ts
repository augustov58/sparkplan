/**
 * #206 (owner rulings 2026-11-24): the Part III aggregate's 100 % rows cite
 * the section that sets the load.
 * - Water heater → "NEC 220.14(A) (Specific Appliances or Loads)" (was "220.51 (Fixed Appliances)").
 * - Heating, nothing omitted → "NEC 220.51 (Fixed Electric Space Heating)".
 * - Cooling, nothing omitted → "NEC 220.14(C), 440.6(A) (Air-Conditioning)".
 * - "NEC 220.60 (Omit …)" only when a load is actually omitted (> 0 VA).
 * Values unchanged. Fixture: "QA Commercial panel" (the issue's Acceptance).
 */
import { describe, it, expect } from 'vitest';
import { calculateAggregatedLoad } from '../services/calculations/upstreamLoadAggregation';
import type { Database } from '../lib/database.types';
import type { NecEdition } from '../data/nec/evse-load';
import { shortCitation } from '../services/pdfExport/PanelScheduleDocuments';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];

const mdp = {
  id: 'mdp', name: 'MDP', bus_rating: 200, main_breaker_amps: 200, voltage: 208, phase: 3, num_spaces: 42,
  project_id: 'p', is_main: true, fed_from: null, fed_from_type: 'service', fed_from_transformer_id: null,
} as unknown as Panel;
let n = 0;
const circuit = (description: string, load_type: string, load_watts: number): Circuit => ({
  id: `c${n++}`, panel_id: 'mdp', description, load_type, load_watts, breaker_amps: 20, project_id: 'p',
  circuit_number: n, pole: 1, is_proposed: false,
} as unknown as Circuit);

/** "QA Commercial panel"'s seven circuits; `heaterTypes` re-types Unit heater 1–4. */
const fixture = (heaterTypes = ['H', 'H', 'H', 'H']) => [
  circuit('Lighting', 'L', 3_000),
  circuit('Receptacles', 'R', 1_800),
  circuit('Water heater', 'W', 4_500),
  ...heaterTypes.map((t, i) => circuit(`Unit heater ${i + 1}`, t, 3_000)),
];
const agg = (circuits: Circuit[], edition: NecEdition = '2020') =>
  calculateAggregatedLoad('mdp', [mdp], circuits, [], 'commercial', undefined, edition);
const row = (r: ReturnType<typeof agg>, prefix: string) => r.demandBreakdown.find(b => b.loadType.startsWith(prefix));

describe('#206 the aggregate cites the section that sets each 100 % load', () => {
  it('water heater: 220.14(A), 4.5 kVA at 100 %', () => {
    const r = agg(fixture());
    expect(row(r, 'Water Heater')).toMatchObject({
      connectedVA: 4_500, demandVA: 4_500, demandFactor: 1, necReference: 'NEC 220.14(A) (Specific Appliances or Loads)',
    }); // main: NEC 220.51 (Fixed Appliances)
    expect(r.necReferences).toContain('NEC 220.14(A) (Specific Appliances or Loads)');
    expect(r.necReferences.join(' ')).not.toContain('Fixed Appliances');
  });

  it('heating with nothing omitted: 220.51, 12.0 kVA at 100 %; total unchanged', () => {
    const r = agg(fixture());
    expect(row(r, 'HVAC')).toMatchObject({
      loadType: 'HVAC - Heating (larger)', connectedVA: 12_000, demandVA: 12_000, demandFactor: 1,
      necReference: 'NEC 220.51 (Fixed Electric Space Heating)',
    }); // main: NEC 220.60 (Omit 0.0kVA cooling)
    expect(r.necReferences.join(' ')).not.toContain('220.60');
    expect(r.totalConnectedVA).toBe(21_300);
    expect(r.totalDemandVA).toBe(21_300);
  });

  it('a cooling load omitted: 220.60 (Omit 3.0kVA cooling), demand 9.0 of 12.0 kVA', () => {
    const r = agg(fixture(['H', 'H', 'H', 'C']));
    expect(row(r, 'HVAC')).toMatchObject({
      loadType: 'HVAC - Heating (larger)', connectedVA: 12_000, demandVA: 9_000, necReference: 'NEC 220.60 (Omit 3.0kVA cooling)',
    });
    expect(row(r, 'HVAC')!.demandFactor).toBeCloseTo(0.75, 10);
    expect(r.totalDemandVA).toBe(18_300);
  });

  it('cooling with nothing omitted: 220.14(C), 440.6(A), 12.0 kVA at 100 %', () => {
    const r = agg(fixture(['C', 'C', 'C', 'C']));
    expect(row(r, 'HVAC')).toMatchObject({
      loadType: 'HVAC - Cooling (larger)', connectedVA: 12_000, demandVA: 12_000, demandFactor: 1,
      necReference: 'NEC 220.14(C), 440.6(A) (Air-Conditioning)',
    }); // main: NEC 220.60 (Omit 0.0kVA heating)
  });

  it('the same citations under NEC 2023 (the sections keep their numbers)', () => {
    const r = agg(fixture(), '2023');
    expect(row(r, 'Water Heater')!.necReference).toBe('NEC 220.14(A) (Specific Appliances or Loads)');
    expect(row(r, 'HVAC')!.necReference).toBe('NEC 220.51 (Fixed Electric Space Heating)');
    expect(r.totalDemandVA).toBe(21_300);
  });
});

describe('#206 the panel schedule PDF keeps subsection letters in its NEC column (E-301)', () => {
  it('drops the title, keeps (A) / (C) and the 440.6(A) reference', () => {
    expect(shortCitation('NEC 220.14(A) (Specific Appliances or Loads)')).toBe('220.14(A)'); // main: 220.14
    expect(shortCitation('NEC 220.14(C), 440.6(A) (Air-Conditioning)')).toBe('220.14(C), 440.6(A)'); // main: 220.14
    expect(shortCitation('NEC 220.51 (Fixed Electric Space Heating)')).toBe('220.51');
    expect(shortCitation('NEC 220.60 (Omit 3.0kVA cooling)')).toBe('220.60');
  });

  it('other rows print as before, or keep subsections main cut off', () => {
    expect(shortCitation('Table 220.42 (All others)')).toBe('Table 220.42');
    expect(shortCitation('NEC 220.44')).toBe('220.44');
    expect(shortCitation('NEC 625.42 (EVEMS — feeder demand clamped to setpoint)')).toBe('625.42');
    expect(shortCitation('NEC 220.84(C)(5) (larger of A/C or electric heat) + 220.60 (non-coincident)'))
      .toBe('220.84(C)(5) + 220.60'); // main: 220.84
  });
});
