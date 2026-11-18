/**
 * #261: non-dwelling receptacle demand (first 10 kVA at 100%, the rest at 50%)
 * is 220.44 in NEC 2020 and 220.47 in NEC 2023. Same numbers in both.
 */
import { describe, it, expect } from 'vitest';
import { calculateCommercialLoad, type CommercialLoadInput } from '../services/calculations/commercialLoad';
import { calculateCommonAreaLoads } from '../services/calculations/multiFamilyEV';
import type { NecEdition } from '../data/nec/evse-load';

const commercial = (necEdition: NecEdition) => calculateCommercialLoad({
  occupancyType: 'office_buildings', totalFloorArea: 10_000, generalReceptacleCount: 100,
  hvacLoads: [], motorLoads: [], serviceVoltage: 208, servicePhase: 3, necEdition,
} as CommercialLoadInput);

describe('#261 receptacle demand section by edition', () => {
  it('the Commercial Load Calculator: 220.44 (2020) / 220.47 (2023), same demand', () => {
    const row = (e: NecEdition) => commercial(e).loadBreakdown.find(i => /Receptacle/i.test(i.category))!;
    expect(row('2020').necReference).toBe('NEC 220.14, 220.44');
    expect(row('2023').necReference).toBe('NEC 220.14, 220.47');
    // 100 × 180 VA = 18,000 VA → 10,000 + 8,000 × 50% = 14,000 VA under both
    expect(row('2020').demandLoad_VA).toBe(14_000);
    expect(row('2023').demandLoad_VA).toBe(14_000);
  });

  it('multifamily common-area receptacles', () => {
    const items = [{ category: 'receptacles' as const, description: 'Lobby', inputType: 'va' as const, value: 12_000 }];
    expect(calculateCommonAreaLoads(items, '2020').items[0]!.necReference).toBe('NEC 220.44');
    expect(calculateCommonAreaLoads(items, '2023').items[0]!.necReference).toBe('NEC 220.47');
  });
});
