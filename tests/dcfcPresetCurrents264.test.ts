/**
 * #264: a DC fast charger's input current is at least its output:
 * kW ÷ (480 V × √3). The EV Charging presets for 100–350 kW listed less
 * (150 kW at 160 A = 133 kVA), and the calculator turns the preset straight
 * into load (√3 × V × A), so every result from them was low. Same rule and
 * rounding as the EV Panel Builder's 150 kW charger (#249): 180.4 A.
 */
import { describe, it, expect } from 'vitest';
import { EV_CHARGER_SPECS, calculateEVCharging } from '../services/calculations/evCharging';

describe('#264 DC fast charger presets', () => {
  it('every DC preset carries at least its output (within 0.1 A rounding)', () => {
    for (const s of EV_CHARGER_SPECS.Level3_DCFC) {
      const floorA = (s.power_kw * 1000) / (s.voltage * Math.sqrt(3));
      expect(s.maxAmps).toBeGreaterThanOrEqual(floorA - 0.05);
    }
  });

  it('the presets: 120.3 / 180.4 / 300.7 / 421.0 A for 100 / 150 / 250 / 350 kW; 50 kW keeps 63 A', () => {
    const byKw = Object.fromEntries(EV_CHARGER_SPECS.Level3_DCFC.map(s => [s.power_kw, s.maxAmps]));
    expect(byKw).toEqual({ 50: 63, 100: 120.3, 150: 180.4, 250: 300.7, 350: 421 });
  });

  it('150 kW: 150 kVA, a 250 A breaker (125% of 180.4 A = 225.5 A), as the EV Panel Builder', () => {
    const r = calculateEVCharging({
      chargerLevel: 'Level3_DCFC', chargerAmps: 180.4, voltage: 480, phase: 3, numChargers: 1,
      simultaneousUse: 100, circuitLength_ft: 50, conductorMaterial: 'Cu', necEdition: '2020',
    } as Parameters<typeof calculateEVCharging>[0]);
    expect(r.circuitBreakerAmps).toBe(250);
    expect(r.totalConnectedLoad_kVA).toBeCloseTo(150, 0);
  });
});
