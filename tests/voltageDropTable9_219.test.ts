/**
 * #219: the AC-impedance voltage drop takes effective Z from the row's R and
 * XL per NEC Chapter 9 Table 9 Note 2 (Ze = R·PF + XL·sin θ), not the stored
 * column that ran 10–20% low, and multiplies the line-to-neutral drop by √3 on
 * three-phase (it used 1). Values: "QA MF feeders" (the issue's hand calc).
 */
import { describe, it, expect } from 'vitest';
import { calculateVoltageDropAC, calculateMaxCircuitLength, effectiveImpedance } from '../services/calculations/voltageDrop';
import { checkFeederLoadStatus } from '../services/feeder/feederLoadSync';
import type { Database } from '../lib/database.types';

describe('#219 effective Z (Table 9 Note 2)', () => {
  it('R·PF + XL·sin(arccos PF)', () => {
    expect(effectiveImpedance(0.10, 0.043, 0.85)).toBeCloseTo(0.10 * 0.85 + 0.043 * Math.sqrt(1 - 0.85 ** 2), 9); // 0.10765
    expect(effectiveImpedance(0.10, 0.043, 1)).toBeCloseTo(0.10, 9); // unity PF: R alone
  });

  it('F-Unit101: 2/0 Cu, 123.75 A, 50 ft, 240 V 1Φ → 1.33 V, 0.56% (was 1.13 V, 0.47%)', () => {
    const r = calculateVoltageDropAC('2/0 AWG', 'Cu', 'PVC', 50, 123.75, 240, 1);
    expect(r.voltageDropVolts).toBe(1.33); // 2 × 123.75 × 50 × 0.10765 / 1000 = 1.3322, printed to 0.01 V
    expect(r.voltageDropPercent.toFixed(2)).toBe('0.56');
  });

  it('F-House: 1 AWG Cu, 80.4 A → 1.22 V, 0.51%', () => {
    const r = calculateVoltageDropAC('1 AWG', 'Cu', 'PVC', 50, 80.4, 240, 1);
    expect(r.voltageDropVolts).toBe(1.22); // 1.2199
    expect(r.voltageDropPercent.toFixed(2)).toBe('0.51');
  });

  it('three-phase takes √3 on the line-to-neutral drop', () => {
    // 2/0 Cu, 100 A, 100 ft, 208 V 3Φ: √3 × 100 × 100 × 0.10765 / 1000 = 1.8646 V (was 1.0765 V)
    const r = calculateVoltageDropAC('2/0 AWG', 'Cu', 'PVC', 100, 100, 208, 3);
    expect(r.voltageDropVolts).toBe(1.86); // √3 × 100 × 100 × 0.10765 / 1000 = 1.8646
  });

  it('max circuit length uses the same Ze and multiplier', () => {
    // 3% of 240 V = 7.2 V; L = 7,200 / (0.10765 × 123.75 × 2) = 270.2 ft
    expect(calculateMaxCircuitLength('2/0 AWG', 'Cu', 'PVC', 123.75, 240, 1).maxLengthFeet).toBeCloseTo(270.2, 0);
  });
});

describe('#219 a feeder whose stored voltage drop predates the formula is flagged', () => {
  type Panel = Database['public']['Tables']['panels']['Row'];
  const mdp = { id: 'mdp', name: 'MDP', voltage: 240, phase: 1, is_main: true } as unknown as Panel;
  const unit = { id: 'u', name: 'Unit 101 Panel', voltage: 240, phase: 1 } as unknown as Panel;
  const feeder = {
    id: 'f', name: 'F-Unit101', source_panel_id: 'mdp', destination_panel_id: 'u', source_transformer_id: null,
    phase_conductor_size: '2/0 AWG', conductor_material: 'Cu', distance_ft: 50, sets_in_parallel: 1,
    design_load_va: 123.75 * 240, total_load_va: 0, voltage_drop_percent: 0.47,
  } as never;

  it('stored 0.47% vs 0.56% now → Outdated, with both numbers', () => {
    const s = checkFeederLoadStatus(feeder, [], [mdp, unit]);
    expect(s.vdChanged).toBe(true);
    expect(s.isStale).toBe(true);
    expect(s.cachedVdPercent).toBe(0.47);
    expect(s.currentVdPercent!.toFixed(2)).toBe('0.56');
  });

  it('a feeder recalculated with the formula is current', () => {
    const fresh = { ...(feeder as object), voltage_drop_percent: 0.5551 } as never;
    expect(checkFeederLoadStatus(fresh, [], [mdp, unit]).vdChanged).toBe(false);
  });
});
