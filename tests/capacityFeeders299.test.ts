/**
 * #299 (regression from #283): a 3-phase "Panel Max Capacity" feeder read
 * Outdated ("Design current 400.0 A exceeds the 400 A feeder breaker") because
 * its design load, main × V × √3, reads back as 400.000… A. And the readers
 * that re-size a feeder live (the packet's voltage-drop page, the Copilot)
 * sized it for the circuit load instead of the panel's capacity.
 * Values: the issue's Acceptance section ("QA SC parallel": DP-1 400 A, 480 V
 * 3Φ; feeder 100 ft Cu, 2 sets, Panel Max Capacity).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { feederBreakerReasons, feederCapacityVA, feederDesignCurrentA } from '../services/feeder/feederBreaker';
import { VoltageDropPages } from '../services/pdfExport/VoltageDropDocuments';

/** Every string in the tree, expanding function components (these are pure). */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (React.isValidElement(node)) {
    const { type, props } = node as React.ReactElement<{ children?: React.ReactNode }>;
    if (typeof type === 'function' && !(type.prototype && type.prototype.isReactComponent)) {
      return textOf((type as (p: unknown) => React.ReactNode)(props));
    }
    return textOf(props.children);
  }
  return '';
}

const dp1: any = { id: 'dp1', name: 'DP-1', voltage: 480, phase: 3, bus_rating: 400, main_breaker_amps: 400, feeder_breaker_amps: null, is_main: false };
const mdp: any = { id: 'mdp', name: 'MDP', voltage: 480, phase: 3, bus_rating: 1200, main_breaker_amps: 1200, is_main: true };
// As Feeder Sizing stores it: 400 × 480 × √3 = 332,553.8 VA, rounded up in the row
const feeder: any = {
  id: 'f1', name: 'MDP → DP-1', source_panel_id: 'mdp', destination_panel_id: 'dp1', destination_transformer_id: null,
  sizing_basis: 'capacity', design_load_va: 332_554, total_load_va: 332_554, distance_ft: 100, conductor_material: 'Cu',
  phase_conductor_size: '250 kcmil', sets_in_parallel: 2, num_current_carrying: 4, ambient_temperature_c: 30,
};

describe('#299 a capacity feeder is not "above" its own panel main', () => {
  it('feederCapacityVA: 400 A × 480 V × √3 = 332,553.8 VA; 100 A × 240 V 1Φ = 24,000 VA', () => {
    expect(feederCapacityVA(dp1, 480, 3)).toBeCloseTo(332_553.8, 1);
    expect(feederCapacityVA({ main_breaker_amps: 100 }, 240, 1)).toBe(24_000);
    expect(feederCapacityVA({ main_breaker_amps: null, bus_rating: 225 }, 208, 1)).toBe(46_800);
  });

  it('400.000… A on a 400 A breaker is no reason; on 350 A it is', () => {
    const designA = feederDesignCurrentA(feeder.design_load_va, dp1);
    expect(designA).toBeGreaterThan(400); // 400.0002 — why it used to flag
    expect(feederBreakerReasons(feeder, 400, designA)).toEqual([]);
    expect(feederBreakerReasons(feeder, 350, designA)).toEqual(['Design current 400.0 A exceeds the 350 A feeder breaker']);
    expect(feederBreakerReasons(feeder, 400, 400.06)).toEqual(['Design current 400.1 A exceeds the 400 A feeder breaker']);
  });
});

describe('#299 the voltage-drop page sizes a capacity feeder as Feeder Sizing does', () => {
  it('400.0 A, 2× 250 kcmil Cu, VD 0.47 % (was 0.0 A, 4/0 AWG, 0.00 %)', () => {
    // 200 A per set ÷ 0.8 (4 current-carrying) = 250 A → 250 kcmil (255 A at 75 °C);
    // VD = √3 × 200 A × 0.1 kft × (0.052·0.85 + 0.041·0.527) Ω/kft = 2.28 V = 0.47 % of 480 V
    const text = textOf(React.createElement(VoltageDropPages, {
      projectName: 'QA SC parallel', feeders: [feeder], panels: [mdp, dp1], transformers: [], circuits: [],
    }));
    expect(text).toMatch(/2× 250 kcmil Cu/);
    expect(text).toMatch(/400\.0\s*A/);
    expect(text).toMatch(/0\.47\s*%/);
    expect(text).not.toMatch(/4\/0 AWG/);
  });
});
