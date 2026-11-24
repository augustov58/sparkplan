/**
 * #279 — required AIC per NEC 110.9 (owner ruling 2026-11-21, option a):
 * the first standard interrupting rating at or above the calculated available
 * fault current. No 1.25× margin, and no safety-factor row in the tool or the
 * short-circuit PDFs. Expected values are the issue's hand calculations.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import {
  calculateServiceFaultCurrent,
  calculateDownstreamFaultCurrent,
  calculateDownstreamTransformerFaultCurrent,
} from '../services/calculations/shortCircuit';
import { AvailableFaultCurrentPage } from '../services/pdfExport/PermitPacketDocuments';
import { ShortCircuitTablePages, ShortCircuitCalculationPages } from '../services/pdfExport/ShortCircuitDocuments';

/** Every string in a component's own element tree (child components are not expanded). */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return '';
}

const tx500 = { kva: 500, primaryVoltage: 12470, secondaryVoltage: 480, impedance: 5.75 };

describe('#279 required AIC = first standard rating ≥ available fault current', () => {
  it('service: 500 kVA / 480 V / 5.75 %, 100 ft 500 kcmil Cu in steel → 8,632 A → 10 kA', () => {
    const r = calculateServiceFaultCurrent(tx500, 480, 3, {
      length: 100, conductorSize: '500 kcmil', material: 'Cu', conduitType: 'Steel', setsInParallel: 1,
    });
    expect(r.faultCurrent).toBeCloseTo(8632.2, 0); // guardrail: the fault current itself is unchanged
    expect(r.requiredAIC).toBe(10); // was 14 (8.632 × 1.25 = 10.79 kA)
    expect(r.compliance.compliant).toBe(true);
    expect(r.compliance.necArticle).toContain('110.9');
    expect(r.compliance.message).toContain('Use 10 kA');
    expect(r.details).not.toHaveProperty('safetyFactor');
  });

  it('downstream panel: 10,000 A source, 50 ft 3/0 Cu in steel, 480 V 3Φ → 8,542 A → 10 kA', () => {
    const r = calculateDownstreamFaultCurrent(
      { length: 50, conductorSize: '3/0 AWG', material: 'Cu', conduitType: 'Steel', voltage: 480, phase: 3 },
      10_000,
    );
    expect(r.faultCurrent).toBeCloseTo(8542.3, 0);
    expect(r.requiredAIC).toBe(10); // was 14 (10.68 kA)
    expect(r.details).not.toHaveProperty('safetyFactor');
  });

  it('downstream transformer: 225 kVA 480→208 V, 5.75 %, 32,937 A primary → 9,504 A → 10 kA', () => {
    const r = calculateDownstreamTransformerFaultCurrent(
      { kva: 225, primaryVoltage: 480, secondaryVoltage: 208, impedance: 5.75 }, 32_937, 3,
    );
    expect(r.faultCurrent).toBeCloseTo(9503.5, 0);
    expect(r.requiredAIC).toBe(10); // was 14 (11.88 kA)
    expect(r.details).not.toHaveProperty('safetyFactor');
  });

  it('just above a rating takes the next one: transformer secondary 10,459 A → 14 kA', () => {
    expect(calculateServiceFaultCurrent(tx500, 480, 3).requiredAIC).toBe(14);
  });

  it('above the largest standard rating is not compliant (needs engineering analysis)', () => {
    // 2,500 kVA, 208 V, 1 % Z: 2,500,000 ÷ (√3 · 208 · 0.01) ≈ 693,953 A
    const r = calculateServiceFaultCurrent({ kva: 2500, primaryVoltage: 12470, secondaryVoltage: 208, impedance: 1 }, 208, 3);
    expect(r.faultCurrent).toBeGreaterThan(200_000);
    expect(r.requiredAIC).toBe(200);
    expect(r.compliance.compliant).toBe(false);
    expect(r.compliance.message).toContain('exceeds 200 kA');
  });
});

// A save made before #279 still carries details.safetyFactor in its jsonb.
const legacyResults = {
  faultCurrent: 8632.191,
  requiredAIC: 10,
  details: { sourceFaultCurrent: 10459.244, conductorImpedance: 0.0056, totalImpedance: 0.0321, faultCurrentAtPoint: 8632.191, safetyFactor: 1.25 },
  compliance: { necArticle: 'NEC 110.9 - Interrupting Rating', compliant: true, message: 'Use 10 kA AIC rated breakers or higher' },
};
const savedCalc = {
  id: 'sc1', project_id: 'p', panel_id: null, location_name: 'Service Entrance', calculation_type: 'service',
  service_amps: 200, service_voltage: 480, service_phase: 3, transformer_kva: 500, transformer_impedance: 5.75,
  service_conductor_length: 100, service_conductor_size: '500 kcmil', service_conductor_material: 'Cu', service_conduit_type: 'Steel',
  results: legacyResults, notes: null, created_at: '2026-11-21T00:00:00Z',
} as any;

describe('#279 short-circuit pages print the rating in kA and no safety factor', () => {
  it('Available Fault Current page: Min Required AIC in kA, no safety-factor row', () => {
    const text = textOf(AvailableFaultCurrentPage({
      projectName: 'P',
      input: {
        equipmentAic: [], serviceAmps: 200, serviceVoltage: 480, servicePhase: 3, sourceFaultCurrent: null,
        transformerKVA: 500, transformerImpedance: 5.75, serviceConductorSize: '500 kcmil',
        serviceConductorMaterial: 'Cu', serviceConductorLength: 100, results: legacyResults,
      },
    }) as React.ReactElement);
    expect(text).toMatch(/Minimum required AIC rating\s+10 kA/);
    expect(text).toMatch(/\b10\s+kA\b/);
    expect(text).not.toMatch(/\b10 A\b/); // was "10 A": a kA rating formatted as amps
    expect(text).not.toMatch(/safety factor/i);
  });

  it('short-circuit table page: no "Safety factor of 1.25×" reference', () => {
    const text = textOf(ShortCircuitTablePages({ calculations: [savedCalc], panels: [], projectName: 'P', includeNECReferences: true }) as React.ReactElement);
    expect(text).toContain('NEC 110.9 - Interrupting Rating');
    expect(text).not.toMatch(/safety factor/i);
  });

  it('single-calculation PDF: no "Safety Factor Applied" row', () => {
    const text = textOf(ShortCircuitCalculationPages({ calculation: savedCalc, projectName: 'P' }) as React.ReactElement);
    expect(text).toContain('Fault Current at Point:');
    expect(text).not.toMatch(/safety factor/i);
  });
});
