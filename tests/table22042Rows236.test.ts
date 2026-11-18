/**
 * #236: Table 220.42 keeps only the rows the app reads. The dwelling row has
 * the same three tiers as the PE-ruled Part III walk (residentialLoad.ts,
 * #155): 3,000 VA at 100%, to 120,000 VA at 35%, the rest at 25%. "All
 * others" is 100% (#218). The hotel / warehouse / store rows, unread and off
 * the table, are gone.
 */
import { describe, it, expect } from 'vitest';
import { TABLE_220_42, getLightingDemandFactor } from '../data/nec/table-220-42';

describe('#236 Table 220.42 rows', () => {
  it('has only the rows the app reads', () => {
    expect(TABLE_220_42.map(r => r.occupancyType)).toEqual(['dwelling', 'all_others']);
  });

  it('dwelling units: three tiers, as the Part III walk', () => {
    expect(getLightingDemandFactor('dwelling', 2_000).demandVA).toBe(2_000);
    expect(getLightingDemandFactor('dwelling', 10_000).demandVA).toBe(3_000 + 7_000 * 0.35); // 5,450
    expect(getLightingDemandFactor('dwelling', 120_000).demandVA).toBeCloseTo(3_000 + 117_000 * 0.35, 6); // 43,950
    // was 3,000 + 147,000 × 0.35 = 54,450 (no 25% tier)
    expect(getLightingDemandFactor('dwelling', 150_000).demandVA).toBeCloseTo(3_000 + 117_000 * 0.35 + 30_000 * 0.25, 6); // 51,450
    expect(getLightingDemandFactor('dwelling', 150_000).necReference).toBe('Table 220.42 (Dwelling Units)');
  });

  it('all others: 100%; an unknown occupancy falls back to 100%', () => {
    expect(getLightingDemandFactor('all_others', 50_000)).toMatchObject({ demandVA: 50_000, demandFactor: 1 });
    expect(getLightingDemandFactor('hotel', 50_000)).toMatchObject({ demandVA: 50_000, demandFactor: 1, necReference: 'Table 220.42 (Default - No Demand Factor)' });
  });
});
