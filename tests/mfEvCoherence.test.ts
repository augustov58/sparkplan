/**
 * Multi-Family EV page coherence (#138, #163).
 */
import { describe, it, expect } from 'vitest';
import { calculateMultiFamilyEV, type MultiFamilyEVInput } from '../services/calculations/multiFamilyEV';

// QA St. Pete: 800 A / 240 V 1Ø, 120 kW measured, 48 A chargers.
const base: MultiFamilyEVInput = {
  dwellingUnits: 12, avgUnitSqFt: 850, voltage: 240, phase: 1, existingServiceAmps: 800,
  evChargers: { count: 8, level: 'Level2', ampsPerCharger: 48 },
  necEdition: '2020', existingLoadMethod: 'utility_bill', measuredPeakDemandKW: 120, useEVEMS: true,
};

describe('#138 withUpgrade note when only EVEMS makes the service work', () => {
  it('says "not required if EVEMS is used", not "adequate"', () => {
    const r = calculateMultiFamilyEV(base);
    const notes = r.scenarios.withUpgrade.notes.join(' | ');
    expect(r.scenarios.noEVEMS.maxChargers).toBeLessThan(8);
    expect(notes).toContain('not required if EVEMS is used');
    expect(notes).not.toContain('is adequate');
  });
});

describe('#163 EVEMS below the 12 A minimum', () => {
  it('20 chargers on a 126 A setpoint: supports 10, warns, no "share ~6A" note', () => {
    const r = calculateMultiFamilyEV({ ...base, evChargers: { ...base.evChargers, count: 20 } });
    // Setpoint 175 A × 0.9 ÷ 1.25 = 126 A → 10 chargers at 12 A.
    expect(r.scenarios.withEVEMS.maxChargers).toBe(10);
    const notes = r.scenarios.withEVEMS.notes.join(' | ');
    expect(notes).toContain('below the 12A minimum');
    expect(notes).not.toMatch(/share capacity/);
    expect(r.compliance.warnings.some(w => w.includes('supports 10 of 20'))).toBe(true);
    // Power is the setpoint shared across the 10 supported: 126 A × 240 V / 10 = 3.02 kW,
    // so power × count = the 30.24 kVA setpoint the generator's marker carries.
    expect(r.scenarios.withEVEMS.powerPerCharger_kW! * 10).toBeCloseTo(30.24, 2);
  });

  it('8 chargers on the same setpoint still share normally', () => {
    const r = calculateMultiFamilyEV(base);
    expect(r.scenarios.withEVEMS.maxChargers).toBe(8);
    expect(r.scenarios.withEVEMS.notes.join(' | ')).toMatch(/share capacity: ~16A each/);
  });
});

describe('#157 describeEvDesignDrift', async () => {
  const { describeEvDesignDrift } = await import('../services/calculations/upstreamLoadAggregation');
  const built = [
    ...Array.from({ length: 8 }, (_, i) => ({ description: `EV Charger #${i + 1} - Level 2 (48A)`, load_watts: 11_520 })),
    { description: 'EVEMS Aggregate Setpoint (NEC 625.42)', load_watts: 30_240 },
    { description: 'Lighting Circuit', load_watts: 1_800 },
  ];

  it('flags 20 analysed vs 8 built chargers', () => {
    const note = describeEvDesignDrift({ chargerCount: 20, perChargerVA: 11_520 }, built);
    expect(note).toContain('assumes 20 chargers at 11.52 kVA');
    expect(note).toContain('have 8 EV charger circuits (11.52 kVA)');
  });

  it('flags a rating mismatch at the same count (40 A analysed, 48 A built)', () => {
    expect(describeEvDesignDrift({ chargerCount: 8, perChargerVA: 9_600 }, built)).not.toBeNull();
  });

  it('matching design, or nothing built yet → no note', () => {
    expect(describeEvDesignDrift({ chargerCount: 8, perChargerVA: 11_520 }, built)).toBeNull();
    expect(describeEvDesignDrift({ chargerCount: 8 }, [{ description: 'Lighting Circuit', load_watts: 1_800 }])).toBeNull();
  });
});
