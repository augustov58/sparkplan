/**
 * #304 (owner ruling 2026-11-23): Material Take-Off and panel templates.
 * - Wire: conductors per circuit = poles, plus 1 neutral on 1-pole circuits
 *   (~50 ft each, rounded up to 100 ft); the EGC line is unchanged.
 * - Conduit (a): each circuit's EMT from Chapter 9 at 40 % fill, EGC included
 *   (Table 5 THHN, Table 4 EMT), totalled by trade size (~10 ft per circuit).
 * - Retail template: the 3 lighting circuits are 'L'; Exterior Signage stays
 *   'O' (220.14(F)) and continuous by its description.
 * Expected values: the issue's Acceptance section (hand-calculated).
 */
import { describe, it, expect } from 'vitest';
import {
  branchWiringTakeoff,
  conductorsPerCircuit,
  emtTradeSizeForCircuit,
} from '../services/calculations/racewayFill';
import { getTemplateById } from '../data/project-templates';
import { isContinuousServiceLoad } from '../data/nec/continuous-load';
import { calculateAggregatedLoad } from '../services/calculations/upstreamLoadAggregation';

const circuitsOf = (id: string) => getTemplateById(id)!.panels.flatMap((p) => p.circuits);
const lines = (id: string) => {
  const { items, warnings } = branchWiringTakeoff(circuitsOf(id), true);
  const get = (description: string) => Object.fromEntries(
    items.filter((i) => i.description === description).map((i) => [i.size, i.quantity]),
  );
  return { items, warnings, wire: get('THHN/THWN Copper Wire'), egc: get('Bare or Green Equipment Grounding Conductor'), emt: get('EMT Conduit') };
};

describe('#304 counting rules', () => {
  it('conductors = poles, plus a neutral on 1-pole', () => {
    expect(conductorsPerCircuit(1)).toBe(2);
    expect(conductorsPerCircuit(2)).toBe(2);
    expect(conductorsPerCircuit(3)).toBe(3);
  });

  it('Office "Chiller (100A)": 3 × 1 AWG + 8 AWG EGC = 0.5052 in² → 1-1/4" EMT (1" holds 0.346)', () => {
    const r = emtTradeSizeForCircuit({ pole: 3, conductor_size: '1 AWG', egc_size: '8 AWG' });
    expect(r.fillAreaIn2).toBeCloseTo(0.5052, 4);
    expect(r.tradeSize).toBe('1-1/4');
    expect(r.warnings).toEqual([]);
  });

  it('an unknown conductor size is not guessed: TBD with a warning', () => {
    const { items, warnings } = branchWiringTakeoff([{ pole: 1, conductor_size: '99 AWG', egc_size: null }], true);
    expect(items.find((i) => i.description === 'EMT Conduit')?.size).toBe('TBD');
    expect(warnings[0]).toMatch(/No Chapter 9 area for conductor "99 AWG"/);
  });
});

describe('#304 template take-offs (hand calc)', () => {
  it('Office: 1 AWG 300 ft, 6 AWG 200 ft; EMT 3/4" 1 stick, 1-1/4" 2 sticks', () => {
    const t = lines('commercial-office');
    expect(t.wire).toEqual({ '1 AWG': 300, '6 AWG': 200 }); // main: 100, 100 (one conductor per circuit)
    expect(t.egc).toEqual({ '8 AWG': 100, '10 AWG': 100 }); // unchanged
    expect(t.emt).toEqual({ '3/4"': 1, '1-1/4"': 2 }); // main: 3/4" 3, 1" 1
    expect(t.items.find((i) => i.size === '6 AWG' && i.description.startsWith('THHN'))?.notes).toBe('1 circuit, 3 conductors @ ~50ft avg');
  });

  it('Workshop: 6 AWG 500 ft; 1, 3, 1/0 AWG 200 ft; EMT 3/4" 3, 1" 1, 1-1/4" 1, 1-1/2" 1', () => {
    const t = lines('industrial-workshop');
    expect(t.wire).toEqual({ '6 AWG': 500, '1 AWG': 200, '1/0 AWG': 200, '3 AWG': 200 });
    expect(t.egc).toEqual({ '10 AWG': 200, '8 AWG': 100, '6 AWG': 100 });
    // 208 V transformer circuit: 3 × 0.1855 + 0.0507 = 0.6072 in² > 0.598 (1-1/4") → 1-1/2"
    expect(t.emt).toEqual({ '3/4"': 3, '1"': 1, '1-1/4"': 1, '1-1/2"': 1 });
    expect(t.items.map((i) => i.notes).join(' ')).not.toMatch(/\b1 circuits\b/); // main: "1 circuits"
  });

  it('Retail: 12 AWG 1,000 ft, 14 AWG 100 ft, 10 AWG 300 ft; EMT 1/2" 13 sticks', () => {
    const t = lines('commercial-retail-store');
    expect(t.wire).toEqual({ '12 AWG': 1000, '14 AWG': 100, '10 AWG': 300 }); // main: 500, 100, 100
    expect(t.egc).toEqual({ '12 AWG': 500, '14 AWG': 100, '10 AWG': 100 });
    expect(t.emt).toEqual({ '1/2"': 13 }); // main: 3/4" 13 + 1" 4
    expect(t.warnings).toEqual([]);
  });
});

describe('#304 Retail template load codes and E-101', () => {
  const retail = circuitsOf('commercial-retail-store');

  it('the 3 lighting circuits are L; Exterior Signage stays O and continuous', () => {
    const l = retail.filter((c) => c.load_type === 'L').map((c) => c.description);
    expect(l).toEqual(['Sales Floor Lighting Zone 1', 'Sales Floor Lighting Zone 2', 'Back Room Lighting']);
    const sign = retail.find((c) => c.description === 'Exterior Signage')!;
    expect(sign.load_type).toBeUndefined(); // stored as the column default 'O'
    expect(isContinuousServiceLoad(sign.description)).toBe(true);
  });

  it('E-101 total stays 40.44 kVA; lighting moves out of "other" (5.34 kVA)', () => {
    const panel: any = { id: 'mdp', name: 'Main Distribution Panel', voltage: 208, phase: 3, is_main: true, bus_rating: 400, main_breaker_amps: 400, fed_from_type: 'service', fed_from: null, fed_from_transformer_id: null };
    const asRows = (withTypes: boolean): any[] => retail.map((c, i) => ({
      id: `c${i}`, panel_id: 'mdp', project_id: 'p', circuit_number: c.circuit_number, description: c.description,
      breaker_amps: c.breaker_amps, pole: c.pole, load_watts: c.load_watts, conductor_size: c.conductor_size,
      egc_size: c.egc_size ?? null, load_type: withTypes ? (c.load_type ?? 'O') : 'O',
    }));
    const before = calculateAggregatedLoad('mdp', [panel], asRows(false), [], 'commercial');
    const after = calculateAggregatedLoad('mdp', [panel], asRows(true), [], 'commercial');
    expect(before.totalConnectedVA).toBe(40440);
    expect(before.totalDemandVA).toBe(40440);
    expect(after.totalConnectedVA).toBe(40440);
    expect(after.totalDemandVA).toBe(40440); // lighting at 100 % (Table 220.42, all others)
    const lighting = after.demandBreakdown.filter((d: any) => /light/i.test(String(d.loadType ?? d.category ?? d.description ?? '')));
    expect(lighting.reduce((s: number, d: any) => s + (d.connectedVA ?? d.connectedLoad ?? 0), 0)).toBe(5340);
  });
});
