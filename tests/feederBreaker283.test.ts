/**
 * #283 — a feeder has its own breaker (owner ruling 2026-11-21, option b):
 * stored in panels.feeder_breaker_amps, default the next standard size ≥ the
 * design current ("Calculated Load") or the panel's main ("Panel Max
 * Capacity"); conductors carry the design load and are protected by it
 * (240.4 incl. (B)); the EGC comes from it (250.122); a feeder to a transformer
 * keeps the transformer's primary breaker; Outdated when the conductor isn't
 * protected or the design current exceeds the breaker; the basis is stored.
 * Expected values: the issue's Acceptance section (hand-calculated).
 */
import { describe, it, expect } from 'vitest';
import {
  feederBreakerAmps, feederBreakerReasons, feederDesignCurrentA, feederEgcSize, feederOcpdForSizing, feederSizingBasis,
} from '../services/feeder/feederBreaker';
import { calculateFeederSizing } from '../services/calculations/feederSizing';
import { minimumProtectedAmpacity } from '../data/nec/table-310-16';

const pool = { voltage: 240, phase: 1, main_breaker_amps: 100, bus_rating: 100, feeder_breaker_amps: null as number | null };
const feeder = { sizing_basis: null as string | null, design_load_va: 5355, phase_conductor_size: '10 AWG', conductor_material: 'Cu', sets_in_parallel: 1 };

describe('#283 the feeder breaker', () => {
  it('defaults: load → next standard ≥ 22.31 A = 25 A; capacity → the panel main (100 A)', () => {
    expect(feederDesignCurrentA(5355, pool)).toBeCloseTo(22.31, 2);
    expect(feederBreakerAmps({ panel: pool, feeder })).toBe(25);
    expect(feederBreakerAmps({ panel: pool, feeder: { ...feeder, sizing_basis: 'capacity' } })).toBe(100);
  });
  it('a stored breaker wins; no feeder → the panel main (as before #283)', () => {
    expect(feederBreakerAmps({ panel: { ...pool, feeder_breaker_amps: 60 }, feeder })).toBe(60);
    expect(feederBreakerAmps({ panel: pool })).toBe(100);
  });
  it('a feeder to a transformer keeps the transformer primary breaker', () => {
    expect(feederBreakerAmps({ feeder: { ...feeder, destination_transformer_id: 't' }, transformer: { primary_breaker_amps: 125 } })).toBe(125);
    expect(feederOcpdForSizing({ feeder: { ...feeder, destination_transformer_id: 't' }, transformer: { primary_breaker_amps: 125 } })).toBe(125);
  });
  it('sizing basis is stored, not guessed (null reads as load)', () => {
    expect(feederSizingBasis({ sizing_basis: null })).toBe('load');
    expect(feederSizingBasis({ sizing_basis: 'capacity' })).toBe('capacity');
  });
  it('EGC from Table 250.122, printed with its unit', () => {
    expect(feederEgcSize(25, 'Cu')).toBe('10 AWG');
    expect(feederEgcSize(20, 'Cu')).toBe('12 AWG');
    expect(feederEgcSize(100, 'Cu')).toBe('8 AWG');
  });
  it('240.4(B): the smallest ampacity a breaker protects', () => {
    expect(minimumProtectedAmpacity(25)).toBeCloseTo(20.1, 5);
    expect(minimumProtectedAmpacity(60)).toBeCloseTo(50.1, 5);
    expect(minimumProtectedAmpacity(1000)).toBe(1000);
  });
});

describe('#283 Outdated against the breaker', () => {
  it('design current above the breaker', () => {
    expect(feederBreakerReasons(feeder, 20, 22.31)).toEqual(['Design current 22.3 A exceeds the 20 A feeder breaker']);
  });
  it('conductor not protected (10 AWG on 60 A: 30 A at 60 °C)', () => {
    expect(feederBreakerReasons(feeder, 60, 22.31)[0]).toMatch(/10 AWG Cu \(30 A at 60 °C\) is not protected by the 60 A feeder breaker/);
  });
  it('parallel sets add ampacity (2 × 3/0 Cu = 400 A at 75 °C on 400 A)', () => {
    expect(feederBreakerReasons({ ...feeder, phase_conductor_size: '3/0 AWG', sets_in_parallel: 2 }, 400, 300)).toEqual([]);
    expect(feederBreakerReasons({ ...feeder, phase_conductor_size: '3/0 AWG', sets_in_parallel: 1 }, 400, 300)).toHaveLength(1);
  });
  it('consistent: 10 AWG on 25 A at 22.31 A', () => {
    expect(feederBreakerReasons(feeder, 25, 22.31)).toEqual([]);
  });
});

// The "QA SF subpanel 217" feeder: 60 ft Cu, 4 current-carrying (80 %), 30 °C, 75 °C insulation, 240 V 1Φ
const size = (ocpd?: number, load = 5355) => calculateFeederSizing({
  source_voltage: 240, source_phase: 1, destination_voltage: 240, destination_phase: 1,
  total_load_va: load, continuous_load_va: 0, noncontinuous_load_va: load,
  distance_ft: 60, conductor_material: 'Cu', ambient_temperature_c: 30, num_current_carrying: 4,
  max_voltage_drop_percent: 3, temperature_rating: 75, sets_in_parallel: 1, ocpd_amps: ocpd,
});

describe('#283 calculateFeederSizing against the breaker', () => {
  it('default breaker 25 A → 10 AWG, EGC 10 AWG', () => {
    const r = size();
    expect([r.ocpd_amps, r.phase_conductor_size, r.egc_size]).toEqual([25, '10 AWG', '10 AWG']);
  });
  it('a 60 A breaker → conductors protected by it: 4 AWG (6 AWG is 44 A after 80 %), EGC 10 AWG', () => {
    const r = size(60);
    expect([r.ocpd_amps, r.phase_conductor_size, r.egc_size]).toEqual([60, '4 AWG', '10 AWG']);
  });
  it('a 20 A breaker → still 10 AWG for the 22.31 A load, EGC 12 AWG', () => {
    const r = size(20);
    expect([r.ocpd_amps, r.phase_conductor_size, r.egc_size]).toEqual([20, '10 AWG', '12 AWG']);
  });
  it('Panel Max Capacity: 100 A × 240 V = 24,000 VA on the 100 A main → EGC 8 AWG', () => {
    const r = size(100, 24000);
    expect([r.ocpd_amps, r.egc_size, r.design_load_va]).toEqual([100, '8 AWG', 24000]);
    expect(feederBreakerReasons({ ...feeder, phase_conductor_size: r.phase_conductor_size }, 100, 100)).toEqual([]);
  });
});
