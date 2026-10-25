/**
 * #158: saved calculator results are recomputed on read under the current
 * rules; the saved copy is used only when its inputs were never saved.
 */
import { describe, it, expect } from 'vitest';
import { calculateMultiFamilyEV } from '../services/calculations/multiFamilyEV';
import {
  DEFAULT_APPLIANCES,
  buildMfEvInput,
  calculateMultiFamilyLoadForProject,
  mfEvCalculationFromSettings,
  multiFamilyLoadFromSettings,
  sameMfEvInputs,
  toStoredMultiFamilyLoad,
  type MfEvSavedInputs,
  type StoredMultiFamilyLoad,
} from '../lib/storedCalcs';

const appliances = {
  ...DEFAULT_APPLIANCES,
  range: { enabled: true, kw: 12, type: 'electric' as const },
  hvac: { enabled: true, type: 'heat_pump' as const, coolingKw: 3.5, heatingKw: 10 },
};
const unitTemplates = [{ id: 't', name: 'Unit', squareFootage: 900, unitCount: 12, appliances }];
const proposedLoads = [{ id: 'p', description: 'Water heater', kw: 4.5, voltage: 240 as const, continuous: false }];

/** What the Dwelling Load Calculator saves for these inputs today. */
const current = (edition: '2020' | '2023' = '2020') => toStoredMultiFamilyLoad(
  calculateMultiFamilyLoadForProject(unitTemplates, appliances, proposedLoads, 15000, edition),
  unitTemplates, appliances, 15000,
);
/** The same save under an older rule: demand understated (e.g. #133's 65% heat). */
const stale = (): StoredMultiFamilyLoad => ({ ...current(), totalDemandVA: current().totalDemandVA - 18000 });

const residential = (o: Record<string, unknown> = {}) => ({
  dwellingType: 'multi_family', appliances, unitTemplates, proposedLoads,
  multiFamilyLoadResult: stale(), ...o,
});

const savedInputs = (o: Partial<MfEvSavedInputs> = {}): MfEvSavedInputs => ({
  dwellingUnits: 12, avgUnitSqFt: 900, voltage: 208, phase: 3, existingServiceAmps: 600,
  evChargerCount: 6, evChargerLevel: 'Level2', evAmpsPerCharger: 40,
  hasElectricHeat: true, hasElectricCooking: true, commonAreaLoadVA: 15000,
  useItemizedCommonArea: false, commonAreaItems: [],
  hasTransformer: false, transformerKVA: 500, useEVEMS: false, capacityReserveVA: 0,
  existingLoadMethod: 'calculated', measuredPeakDemandKW: 0, measurementPeriod: '', utilityCompany: '',
  ...o,
});

describe('multiFamilyLoadFromSettings', () => {
  it('recomputes a saved 220.84 load under the current rules', () => {
    const r = multiFamilyLoadFromSettings(residential(), '2020')!;
    expect(r.totalDemandVA).toBe(current().totalDemandVA);
    expect(r.totalDemandVA).not.toBe(stale().totalDemandVA);
    expect(r).toMatchObject({ dwellingUnits: 12, avgUnitSqFt: 900, commonAreaLoadVA: 15000, hasElectricHeat: true });
  });

  it('follows the project edition', () => {
    expect(multiFamilyLoadFromSettings(residential(), '2023')!.totalDemandVA).toBe(current('2023').totalDemandVA);
  });

  it('null when the calculator never ran; as saved when its inputs are missing', () => {
    expect(multiFamilyLoadFromSettings(residential({ multiFamilyLoadResult: undefined }), '2020')).toBeNull();
    expect(multiFamilyLoadFromSettings(residential({ unitTemplates: undefined }), '2020')).toEqual(stale());
    expect(multiFamilyLoadFromSettings(undefined, '2020')).toBeNull();
  });
});

describe('buildMfEvInput', () => {
  it('calculated method: the building comes from the 220.84 load', () => {
    const mf = current();
    const input = buildMfEvInput(savedInputs({ dwellingUnits: 99, commonAreaLoadVA: 1 }), mf, '2020');
    expect(input.preCalculatedBuildingLoad?.totalDemandVA).toBe(mf.totalDemandVA);
    expect(input.dwellingUnits).toBe(12);
    expect(input.commonAreaLoadVA).toBe(15000);
  });

  it('measured method: the entered profile and peak demand, no 220.84 import', () => {
    const input = buildMfEvInput(savedInputs({
      existingLoadMethod: 'utility_bill', measuredPeakDemandKW: 180, dwellingUnits: 14, utilityCompany: 'FPL',
    }), current(), '2020');
    expect(input.preCalculatedBuildingLoad).toBeUndefined();
    expect(input).toMatchObject({ dwellingUnits: 14, measuredPeakDemandKW: 180, utilityCompany: 'FPL' });
  });
});

describe('mfEvCalculationFromSettings', () => {
  const savedResult = calculateMultiFamilyEV(buildMfEvInput(savedInputs(), stale(), '2020'));

  it('recomputes from saved inputs with the recomputed 220.84 load', () => {
    const r = mfEvCalculationFromSettings(residential({
      mfEvCalculation: { result: savedResult, buildingName: 'Bayview', inputs: savedInputs() },
    }), '2020')!;
    expect(r.recomputed).toBe(true);
    expect(r.buildingName).toBe('Bayview');
    expect(r.result.buildingLoad.buildingDemandVA).toBe(current().totalDemandVA);
    expect(r.result.buildingLoad.buildingDemandVA).not.toBe(savedResult.buildingLoad.buildingDemandVA);
  });

  it('a result saved without inputs prints as saved', () => {
    const r = mfEvCalculationFromSettings(residential({ mfEvCalculation: { result: savedResult } }), '2020')!;
    expect(r.recomputed).toBe(false);
    expect(r.result).toBe(savedResult);
    expect(mfEvCalculationFromSettings(residential(), '2020')).toBeNull();
  });
});

it('sameMfEvInputs ignores key order (jsonb reorders keys)', () => {
  const a = savedInputs({ commonAreaItems: [{ category: 'lighting', description: 'Hall', inputType: 'va', value: 500 } as any] });
  const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(a).reverse())));
  expect(sameMfEvInputs(a, reordered)).toBe(true);
  expect(sameMfEvInputs(a, { ...a, evChargerCount: 7 })).toBe(false);
  expect(sameMfEvInputs(undefined, a)).toBe(false);
});
