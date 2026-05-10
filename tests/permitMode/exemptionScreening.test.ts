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
  it('residential 400 A @ $50k → exempt', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'residential',
      serviceCapacity_240V_amps: 400,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('exempt');
    expect(result.necReferences).toContain('FS 471.003(2)(h)');
    expect(result.ahjOverride).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it('commercial 600 A @ $100k → exempt', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 100_000,
      occupancyType: 'commercial',
      serviceCapacity_240V_amps: 600,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('exempt');
    expect(result.necReferences).toContain('FS 471.003(2)(h)');
  });

  it('boundary: residential exactly 600 A → exempt (≤ threshold)', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'residential',
      serviceCapacity_240V_amps: 600,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('exempt');
  });

  it('boundary: commercial exactly 800 A → exempt (≤ threshold)', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'commercial',
      serviceCapacity_240V_amps: 800,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('exempt');
  });

  it('boundary: project value exactly $125,000 → exempt (≤ threshold)', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 125_000,
      occupancyType: 'residential',
      serviceCapacity_240V_amps: 200,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('exempt');
  });
});

describe('screenContractorExemption — pe-required (threshold exceeded)', () => {
  it('residential 800 A (over 600 A) → pe-required', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'residential',
      serviceCapacity_240V_amps: 800,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('pe-required');
    expect(result.reason).toContain('Residential');
    expect(result.reason).toContain('600');
    expect(result.necReferences).toContain('FS 471.003(2)(h)');
    expect(result.ahjOverride).toBeUndefined();
  });

  it('commercial 1000 A (over 800 A) → pe-required', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'commercial',
      serviceCapacity_240V_amps: 1000,
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
      serviceCapacity_240V_amps: 200,
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
      serviceCapacity_240V_amps: 1000,
      scopeFlags: baseScopeFlags,
    });

    expect(result.lane).toBe('pe-required');
    expect(result.reason).toContain('Project value');
  });
});

describe('screenContractorExemption — AHJ override', () => {
  it('AHJ override forces pe-required even when within FS thresholds', () => {
    const result = screenContractorExemption({
      estimatedValueUsd: 50_000,
      occupancyType: 'residential',
      serviceCapacity_240V_amps: 200,
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
      serviceCapacity_240V_amps: 2000,
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
      serviceCapacity_240V_amps: 1000,
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
