/**
 * #237: Article 220 was renumbered between NEC 2020 and NEC 2023. Every
 * citation of these sections follows the project's edition:
 *
 * | Quantity                                 | NEC 2020     | NEC 2023        |
 * |------------------------------------------|--------------|-----------------|
 * | Dwelling unit load, 3 VA/ft²             | 220.14(J)    | 220.41          |
 * | Non-dwelling general lighting unit loads | Table 220.12 | Table 220.42(A) |
 * | General lighting demand factors          | Table 220.42 | Table 220.45    |
 */
import { describe, it, expect } from 'vitest';
import { article220Citations } from '../data/nec/article220-citations';
import { getLightingDemandFactor } from '../data/nec/table-220-42';
import { calculateCommercialLoad, type CommercialLoadInput } from '../services/calculations/commercialLoad';
import { calculateDwellingStandardLoad, calculateDwellingUnitPanelLoad } from '../services/calculations/residentialLoad';
import { calculateCommonAreaLoads } from '../services/calculations/multiFamilyEV';
import { getNEC22087NarrativeCopy } from '../services/pdfExport/PermitPacketDocuments';
import type { NecEdition } from '../data/nec/evse-load';

const commercial = (necEdition: NecEdition): CommercialLoadInput => ({
  occupancyType: 'office_buildings',
  totalFloorArea: 10_000,
  generalReceptacleCount: 50,
  hvacLoads: [],
  motorLoads: [],
  serviceVoltage: 208,
  servicePhase: 3,
  necEdition,
});

describe('#237 Article 220 citations by edition', () => {
  it('the table of renumbered sections', () => {
    expect(article220Citations('2020')).toEqual({ dwellingUnitLoad: '220.14(J)', unitLoadTable: 'Table 220.12', lightingDemandTable: 'Table 220.42', receptacleDemand: '220.44' });
    expect(article220Citations('2023')).toEqual({ dwellingUnitLoad: '220.41', unitLoadTable: 'Table 220.42(A)', lightingDemandTable: 'Table 220.45', receptacleDemand: '220.47' }); // receptacles: #261
  });

  it('demand factors: Table 220.42 (2020) / 220.45 (2023), same values', () => {
    const y20 = getLightingDemandFactor('dwelling', 10_000, '2020');
    const y23 = getLightingDemandFactor('dwelling', 10_000, '2023');
    expect(y20.necReference).toBe('Table 220.42 (Dwelling Units)');
    expect(y23.necReference).toBe('Table 220.45 (Dwelling Units)');
    expect(y23.demandVA).toBe(y20.demandVA); // 3,000 + 7,000 × 35% = 5,450
    expect(getLightingDemandFactor('all_others', 1, '2023').necReference).toBe('Table 220.45 (All others)');
  });

  it('the Commercial Load Calculator: unit loads from Table 220.12 (2020) / 220.42(A) (2023)', () => {
    for (const [edition, table] of [['2020', 'Table 220.12'], ['2023', 'Table 220.42(A)']] as const) {
      const r = calculateCommercialLoad(commercial(edition));
      const lighting = r.loadBreakdown.find(i => i.category.startsWith('General Lighting'))!;
      expect(lighting.necReference).toBe(`NEC ${table}`);
      expect(lighting.category).toBe(`General Lighting (Continuous - 125% included in ${table})`);
      // The service-sizing note still finds the lighting row (it used to match '220.42(A)' in the citation)
      expect(r.notes.join(' ')).toContain(`Lighting from ${table} (${Math.round(lighting.serviceSizingLoad_VA)} VA, 125% already included)`);
    }
    // Same numbers under both editions
    expect(calculateCommercialLoad(commercial('2023')).totalDemandLoad_VA).toBe(calculateCommercialLoad(commercial('2020')).totalDemandLoad_VA);
  });

  it('dwelling Part III: 220.14(J) / 220.41 for the unit load, 220.42 / 220.45 for the demand', () => {
    const input = { lightingVA: 6_000, lightingDescription: '2,000 sq ft × 3 VA', smallApplianceCircuits: 2, laundryCircuit: true, items: [] };
    const y20 = calculateDwellingStandardLoad({ ...input, necEdition: '2020' });
    const y23 = calculateDwellingStandardLoad({ ...input, necEdition: '2023' });
    const refs = (r: typeof y20) => r.breakdown.map(x => x.necReference);
    expect(refs(y20)).toEqual(expect.arrayContaining(['NEC 220.14(J)', 'NEC Table 220.42']));
    expect(refs(y23)).toEqual(expect.arrayContaining(['NEC 220.41', 'NEC Table 220.45']));
    expect(refs(y20).join(' ')).not.toContain('220.12');
    expect(y23.totalDemandVA).toBe(y20.totalDemandVA);
  });

  it('a unit panel without lighting warns with the edition section', () => {
    const w = calculateDwellingUnitPanelLoad({ circuits: [], existingBuilding: false, necEdition: '2023' }).warnings.join(' ');
    expect(w).toContain('3 VA/ft² general lighting load (NEC 220.41)');
  });

  it('multifamily common-area lighting cites the demand table section', () => {
    const items = [{ category: 'lighting_indoor' as const, description: 'Corridors', inputType: 'va' as const, value: 4_000 }];
    expect(calculateCommonAreaLoads(items, '2020').items[0]!.necReference).toBe('NEC 220.42');
    expect(calculateCommonAreaLoads(items, '2023').items[0]!.necReference).toBe('NEC 220.45');
  });

  it('the 220.87 narrative fallback cites the edition demand table', () => {
    expect(getNEC22087NarrativeCopy('calculated', 'commercial', [], '2020').methodNecRef).toContain('220.42 / 220.44 / 220.56');
    const y23 = getNEC22087NarrativeCopy('calculated', 'commercial', [], '2023').methodNecRef;
    expect(y23).toContain('220.45 / 220.47 / 220.56'); // receptacles 220.47 under 2023 (#261)
    expect(y23).not.toContain('220.42');
  });
});
