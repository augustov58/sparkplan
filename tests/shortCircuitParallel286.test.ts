/**
 * #286 — a feeder's sets in parallel reach the downstream short-circuit
 * calculation (owner OK 2026-11-22; shortCircuit.ts is a stable module):
 * the conductor impedance is divided by the number of sets, as the service
 * path already does. Expected values: the issue's Acceptance section,
 * hand-calculated (point-to-point, Table 9 steel; 480 V 3Φ, V_LN = 277.13 V).
 */
import { describe, it, expect } from 'vitest';
import { calculateDownstreamFaultCurrent, calculateServiceFaultCurrent } from '../services/calculations/shortCircuit';
import { recomputeShortCircuitRow, shortCircuitResultsOf } from '../lib/storedCalcs';
import { derivePanelFormState } from '../components/ShortCircuitProjectCalculator';

const run = (sets?: number) => ({
  length: 100, conductorSize: '4/0 AWG', material: 'Cu' as const, conduitType: 'Steel' as const,
  voltage: 480, phase: 3 as const, ...(sets ? { setsInParallel: sets } : {}),
});

describe('#286 calculateDownstreamFaultCurrent divides the run by its sets', () => {
  it('the issue example: 22,000 A, 100 ft 4/0 Cu steel → 1 set 13,386 A / 14 kA, 2 sets 16,645 A / 22 kA', () => {
    const one = calculateDownstreamFaultCurrent(run(1), 22_000);
    const two = calculateDownstreamFaultCurrent(run(2), 22_000);
    expect(one.faultCurrent).toBeCloseTo(13386, -1);
    expect(one.requiredAIC).toBe(14);
    expect(two.faultCurrent).toBeCloseTo(16645, -1);
    expect(two.requiredAIC).toBe(22);
  });

  it('no sets given = one set (the Tools calculator and other callers unchanged)', () => {
    expect(calculateDownstreamFaultCurrent(run(), 22_000).faultCurrent)
      .toBe(calculateDownstreamFaultCurrent(run(1), 22_000).faultCurrent);
  });

  it('"QA SC parallel": service 20,344 A / 22 kA; DP-1 2 sets 15,679 A / 22 kA, 1 set 12,755 A / 14 kA', () => {
    // I_xfmr = 1,000,000 / (√3·480·0.0575) = 20,918.5 A; 20 ft 500 kcmil × 3 → 20,344.4 A
    const svc = calculateServiceFaultCurrent(
      { kva: 1000, primaryVoltage: 12470, secondaryVoltage: 480, impedance: 5.75 }, 480, 3,
      { length: 20, conductorSize: '500 kcmil', material: 'Cu', conduitType: 'Steel', setsInParallel: 3 },
    );
    expect(svc.faultCurrent).toBeCloseTo(20344.4, 0);
    expect(svc.requiredAIC).toBe(22);
    const two = calculateDownstreamFaultCurrent(run(2), svc.faultCurrent);
    const one = calculateDownstreamFaultCurrent(run(1), svc.faultCurrent);
    expect(two.faultCurrent).toBeCloseTo(15679.4, 0);
    expect(two.requiredAIC).toBe(22);
    expect(one.faultCurrent).toBeCloseTo(12754.8, 0);
    expect(one.requiredAIC).toBe(14);
  });
});

const blank = {
  service_amps: null, service_voltage: null, service_phase: null, transformer_kva: null, transformer_impedance: null,
  service_conductor_length: null, service_conductor_size: null, service_conductor_material: null, service_conduit_type: null,
  notes: null, created_at: '2026-11-22T00:00:00Z', updated_at: '2026-11-22T00:00:00Z', user_id: 'u', project_id: 'p',
};
const dp1Row = (results: Record<string, unknown>): any => ({
  ...blank, id: 'dp1calc', panel_id: 'dp1', location_name: 'DP-1', calculation_type: 'panel',
  source_fault_current: 20344.355, feeder_length: 100, feeder_conductor_size: '4/0 AWG', feeder_material: 'Cu',
  feeder_conduit_type: 'Steel', feeder_voltage: 480, feeder_phase: 3, results,
});

describe('#286 saved panel rows are recomputed with their saved sets (#278 rule)', () => {
  it('a save that recorded 2 sets (made before this fix, so it stored the 1-set value) reads 15,679 A / 22 kA', () => {
    const r = shortCircuitResultsOf(recomputeShortCircuitRow(dp1Row({ faultCurrent: 12754.8, requiredAIC: 14, setsInParallel: 2 })));
    expect(r.outdated).toBeUndefined();
    expect(r.faultCurrent).toBeCloseTo(15679.4, 0);
    expect(r.requiredAIC).toBe(22);
    expect(r.setsInParallel).toBe(2);
  });

  it('a panel row saved before the sets were recorded is Outdated, re-run and keeps its stored values', () => {
    const r = shortCircuitResultsOf(recomputeShortCircuitRow(dp1Row({ faultCurrent: 12754.8, requiredAIC: 14 })));
    expect(r.outdated).toMatch(/sets in parallel/);
    expect(r.faultCurrent).toBe(12754.8); // never recomputed with a guessed 1 set
    expect(r.requiredAIC).toBe(14);
  });
});

describe('#286 derivePanelFormState', () => {
  const feeder: any = { distance_ft: 100, phase_conductor_size: '250 kcmil', conductor_material: 'Cu', conduit_type: 'Steel', sets_in_parallel: 2 };
  it('takes the sets from the feeder and the phase from the panel', () => {
    const out = derivePanelFormState({ id: 'dp1', voltage: 480, phase: 3 } as any, { service_voltage: 240, service_phase: 1 }, feeder);
    expect(out.feederSets).toBe(2);
    expect(out.feederPhase).toBe(3);
    expect(out.feederVoltage).toBe(480);
  });
  it('falls back to the project phase when the panel has none', () => {
    const out = derivePanelFormState({ id: 'dp1', voltage: 480 } as any, { service_voltage: 480, service_phase: 3 }, undefined);
    expect(out.feederPhase).toBe(3);
  });
});
