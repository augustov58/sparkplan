/**
 * Tests — FL Contractor Exemption Screening (Sprint 2A PR 5 / H17)
 *
 * Pure function. Verifies the four lane decisions enumerated in
 * `services/permitMode/exemptionScreening.ts`:
 *
 *   1. Within thresholds                → exempt
 *   2. Project value > $125k            → pe-required
 *   3. Residential > 600 A @ 240 V      → pe-required
 *   4. Commercial > 800 A @ 240 V       → pe-required
 *   5. AHJ override always wins         → pe-required
 *
 * Plus the post-review additions:
 *   6. 480 V / 208 V services normalized to 240 V equivalent (H2 regression)
 *   7. NaN / negative inputs fail-safe to pe-required with warnings (M1)
 */

import { describe, it, expect } from 'vitest';
import {
  screenContractorExemption,
  type ExemptionScreeningInput,
} from '../../services/permitMode/exemptionScreening';

const baseScopeFlags: ExemptionScreeningInput['scopeFlags'] = {
  service_upgrade: false,
  ct_cabinet: false,
  meter_stack: false,
  switchgear: false,
  multi_tenant_feeder: false,
  evems_used: false,
};

describe('screenContractorExemption — exempt lane', () => {
  it('residential 400 A @ 240 V @ $50k → exempt', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'residential',
      serviceCapacityAmps: 400,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('exempt');
    expect(result.necReferences).toContain('FS 471.003(2)(h)');
    expect(result.ahjOverride).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it('commercial 600 A @ 240 V @ $100k → exempt', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 100_000,
      occupancyType: 'commercial',
      serviceCapacityAmps: 600,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('exempt');
    expect(result.necReferences).toContain('FS 471.003(2)(h)');
  });

  it('boundary: residential exactly 600 A @ 240 V → exempt (≤ threshold)', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'residential',
      serviceCapacityAmps: 600,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('exempt');
  });

  it('boundary: commercial exactly 800 A @ 240 V → exempt (≤ threshold)', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'commercial',
      serviceCapacityAmps: 800,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('exempt');
  });

  it('boundary: project value exactly $125,000 → exempt (≤ threshold)', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 125_000,
      occupancyType: 'residential',
      serviceCapacityAmps: 200,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('exempt');
  });
});

describe('screenContractorExemption — pe-required (threshold exceeded)', () => {
  it('residential 800 A @ 240 V (over 600 A) → pe-required', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'residential',
      serviceCapacityAmps: 800,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('pe-required');
    expect(result.reason).toContain('Residential');
    expect(result.reason).toContain('600');
    expect(result.necReferences).toContain('FS 471.003(2)(h)');
    expect(result.ahjOverride).toBeUndefined();
  });

  it('commercial 1000 A @ 240 V (over 800 A) → pe-required', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'commercial',
      serviceCapacityAmps: 1000,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('pe-required');
    expect(result.reason).toContain('Commercial');
    expect(result.reason).toContain('800');
    expect(result.necReferences).toContain('FS 471.003(2)(h)');
  });

  it('$200,000 project value (over $125k) → pe-required', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 200_000,
      occupancyType: 'residential',
      serviceCapacityAmps: 200,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('pe-required');
    expect(result.reason).toContain('Project value');
    expect(result.reason).toContain('125,000');
    expect(result.necReferences).toContain('FS 471.003(2)(h)');
  });

  it('value cap evaluated before service-capacity rule when both exceeded', () => {
    // Both project value AND residential service exceed thresholds. Since
    // the value check runs first, the reason should cite project value.
    const result = screenContractorExemption({
      estimatedValueUsd: 500_000,
      occupancyType: 'residential',
      serviceCapacityAmps: 1000,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('pe-required');
    expect(result.reason).toContain('Project value');
  });
});

describe('screenContractorExemption — non-240 V normalization (H2 regression)', () => {
  // FS 471.003(2)(h) is written in 240 V terms. Pre-fix, the function compared
  // nameplate ampacity to the threshold directly, silently passing 480 V/800 A
  // commercial services into the exempt lane. Fixed by normalizing to 240 V
  // equivalent inside the function.
  it('commercial 480 V / 800 A (1600 A @ 240 V equivalent) → pe-required', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'commercial',
      serviceCapacityAmps: 800,
      serviceVoltageV: 480,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('pe-required');
    expect(result.reason).toContain('Commercial');
    // The reason should surface BOTH the nameplate and the normalized value
    // so the contractor can see why the threshold tripped.
    expect(result.reason).toContain('1600');
    expect(result.reason).toContain('800 A @ 480 V');
  });

  it('residential 480 V / 400 A (800 A @ 240 V equivalent) → pe-required', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'residential',
      serviceCapacityAmps: 400,
      serviceVoltageV: 480,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('pe-required');
    expect(result.reason).toContain('Residential');
    expect(result.reason).toContain('800');
  });

  it('commercial 208 V / 800 A (693 A @ 240 V equivalent) → exempt', () => {
    // 208 V × 800 A / 240 V = 693 A — under the 800 A commercial threshold.
    // This confirms the normalization works in both directions (208 < 240).
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'commercial',
      serviceCapacityAmps: 800,
      serviceVoltageV: 208,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('exempt');
  });
});

describe('screenContractorExemption — defensive coercion (M1 regression)', () => {
  // Pre-fix, NaN and negative inputs silently produced lane='exempt' (the
  // unsafe direction for a compliance flag). Now they fail-safe to
  // pe-required with a WARNING.
  it('NaN estimated value → pe-required + warning', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: Number.NaN,
      occupancyType: 'residential',
      serviceCapacityAmps: 200,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('pe-required');
    expect(result.warnings.some((w) => /value.*invalid/i.test(w))).toBe(true);
  });

  it('negative estimated value → pe-required + warning', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: -100,
      occupancyType: 'residential',
      serviceCapacityAmps: 200,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('pe-required');
    expect(result.warnings.some((w) => /value.*invalid/i.test(w))).toBe(true);
  });

  it('NaN service capacity → pe-required + warning', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'residential',
      serviceCapacityAmps: Number.NaN,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('pe-required');
    expect(result.warnings.some((w) => /capacity.*invalid/i.test(w))).toBe(
      true,
    );
  });

  it('zero/missing voltage → defaults to 240 V + warning, lane still correct', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'residential',
      serviceCapacityAmps: 200,
      serviceVoltageV: 0,
      scopeFlags: baseScopeFlags,
    });

    // 200 A normalized at default 240 V → 200 A, under residential 600 A.
    expect(result.lane).toBe('exempt');
    expect(result.warnings.some((w) => /voltage.*invalid/i.test(w))).toBe(
      true,
    );
  });
});

describe('screenContractorExemption — AHJ override', () => {
  it('AHJ override forces pe-required even when within FS thresholds', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'residential',
      serviceCapacityAmps: 200,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
      ahjOverride: { reason: 'City of Miami requires PE seal on all EVSE installations' },
    });

    expect(result.lane).toBe('pe-required');
    expect(result.ahjOverride).toBe(
      'City of Miami requires PE seal on all EVSE installations',
    );
    expect(result.reason).toContain('AHJ override');
    expect(result.necReferences).toContain('FS 471.003(2)(h)');
    expect(result.necReferences).toContain('AHJ override');
  });

  it('AHJ override wins even when other thresholds also push pe-required', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 500_000,
      occupancyType: 'commercial',
      serviceCapacityAmps: 2000,
      serviceVoltageV: 240,
      scopeFlags: baseScopeFlags,
      ahjOverride: { reason: 'Local amendment LA-2024-07' },
    });

    expect(result.lane).toBe('pe-required');
    expect(result.ahjOverride).toBe('Local amendment LA-2024-07');
    expect(result.reason).toContain('AHJ override');
  });
});

describe('screenContractorExemption — audit fixture', () => {
  it('1000 A residential @ 240 V → pe-required (exceeds 600 A residential threshold)', () => {
    // Audit fixture: 12-unit multifamily, 1000 A @ 240 V / 3φ residential
    // service. NEC + FBC classify multifamily dwellings as residential, so
    // this trips the 600 A residential cap regardless of unit count.
    const result = screenContractorExemption({
      estimatedValueUsd: 100_000,
      occupancyType: 'residential',
      serviceCapacityAmps: 1000,
      serviceVoltageV: 240,
      scopeFlags: {
        ...baseScopeFlags,
        service_upgrade: true,
        meter_stack: true,
        ct_cabinet: true,
      },
    });

    expect(result.lane).toBe('pe-required');
    expect(result.reason).toContain('Residential');
    expect(result.reason).toContain('600');
    expect(result.reason).toContain('1000');
  });
});
