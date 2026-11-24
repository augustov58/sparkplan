/**
 * #205 (owner ruling 2026-11-24): the Commercial Load Calculator's HVAC row
 * takes the nameplate rated-load current (RLA, 440.6(A)) as the Article 220
 * load at 100 %; "Continuous" adds the 125 % in service sizing only (#195).
 * The app, the PDF and the CSV cite "NEC 220.14(C), 440.6(A)". The stored
 * field keeps its name (nameplateFLA). Numbers unchanged: 42 A × 208 V × √3 =
 * 15,131 VA → 15.1 kVA load, 18.9 kVA sizing when continuous.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { calculateCommercialLoad, HVAC_CITATION, type CommercialLoadInput } from '../services/calculations/commercialLoad';
import { buildCommercialLoadCSV, type CommercialLoadExportInput } from '../services/pdfExport/commercialLoadExport';
import { CommercialLoadDocument } from '../services/pdfExport/CommercialLoadDocument';

/** Every string in the tree, expanding function components (pure pages). */
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

// "QA Commercial calc": the calculator's defaults
const input: CommercialLoadInput = {
  occupancyType: 'office_buildings',
  totalFloorArea: 10000,
  generalReceptacleCount: 50,
  hvacLoads: [{ description: 'RTU-1', nameplateFLA: 42, voltage: 208, phase: 3, isContinuous: true }],
  motorLoads: [],
  serviceVoltage: 208,
  servicePhase: 3,
  necEdition: '2020',
};
const result = calculateCommercialLoad(input);
const hvacRow = result.loadBreakdown.find(r => r.category === 'HVAC Equipment')!;
const exportInput = {
  project: { id: 'p', name: 'QA Commercial calc', address: '', necEdition: '2020' },
  occupancyType: input.occupancyType, totalFloorArea: 10000, generalReceptacleCount: 50, signOutlets: 0,
  hvacLoads: input.hvacLoads, motorLoads: [], kitchenEquipment: [], specialLoads: [],
  serviceVoltage: 208, servicePhase: 3, result,
  effectiveMainBreaker: 200, effectiveBusRating: 200, isMainBreakerOverridden: false, isBusOverridden: false,
} as unknown as CommercialLoadExportInput;

describe('#205 the HVAC row is RLA, cited NEC 220.14(C), 440.6(A)', () => {
  it('the calculator row cites 220.14(C), 440.6(A); the numbers are unchanged', () => {
    expect(HVAC_CITATION).toBe('NEC 220.14(C), 440.6(A)');
    expect(hvacRow.necReference).toBe('NEC 220.14(C), 440.6(A)'); // main: NEC 220.14(C), 440.6
    expect(hvacRow.connectedLoad_VA).toBeCloseTo(42 * 208 * Math.sqrt(3), 6); // 15,131 VA
    expect(hvacRow.demandLoad_VA).toBeCloseTo(15_131.2, 0);
    expect(hvacRow.serviceSizingLoad_VA).toBeCloseTo(15_131.2 * 1.25, 0); // 18,914 VA
  });

  it('the CSV labels the input RLA (A) and cites 440.6(A)', () => {
    const csv = buildCommercialLoadCSV(exportInput);
    expect(csv).toContain('RLA (A)');
    expect(csv).not.toContain('MCA'); // main: MCA/FLA (A)
    expect(csv).toContain('"NEC 220.14(C), 440.6(A)"');
  });

  it('the PDF heads the HVAC table with 220.14(C), 440.6(A) and labels the column RLA (A)', () => {
    const text = textOf(React.createElement(CommercialLoadDocument, exportInput));
    expect(text).toContain('NEC 220.14(C), 440.6(A)');
    expect(text).not.toContain('440.22'); // main: HVAC Equipment (NEC 220.14(C), 440.22)
    expect(text).toContain('RLA (A)');
    expect(text).not.toContain('MCA'); // main: MCA/FLA (A)
  });
});
