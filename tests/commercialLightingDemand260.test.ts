/**
 * #260: the Commercial Load Calculator's lighting demand comes from the shared
 * Table 220.42 data (data/nec/table-220-42.ts), not an inline copy. That copy
 * gave hospitals, hotels and warehouses "20 kVA at 50%, the rest at 40%",
 * which put warehouses below the table (30 kVA → 14.0 kVA). Until rows for
 * those occupancies come from the code book (#236), they take "All others".
 */
import { describe, it, expect } from 'vitest';
import { calculateCommercialLoad, type CommercialLoadInput, type OccupancyType } from '../services/calculations/commercialLoad';

const run = (occupancyType: OccupancyType, totalFloorArea: number) =>
  calculateCommercialLoad({
    occupancyType,
    totalFloorArea,
    generalReceptacleCount: 0,
    hvacLoads: [],
    motorLoads: [],
    serviceVoltage: 480,
    servicePhase: 3,
    necEdition: '2020',
  } as CommercialLoadInput);

describe('#260 commercial lighting demand', () => {
  it('a warehouse with 30,000 VA of lighting takes 30,000 VA (was 14,000)', () => {
    const r = run('warehouse', 25_000); // 25,000 sq ft × 1.2 VA = 30,000 VA
    expect(r.lightingLoad_VA).toBe(30_000);
    expect(r.lightingDemandLoad_VA).toBe(30_000);
  });

  it('hospitals and hotels take 100% too (were 50% / 40% above 20 kVA)', () => {
    const hospital = run('hospitals', 50_000); // × 1.6 = 80,000 VA
    expect(hospital.lightingDemandLoad_VA).toBe(80_000);
    const hotel = run('hotels_motels', 50_000); // × 1.7 = 85,000 VA
    expect(hotel.lightingDemandLoad_VA).toBe(85_000);
  });

  it('other occupancies are unchanged at 100%', () => {
    const office = run('office_buildings', 10_000); // × 1.3 = 13,000 VA
    expect(office.lightingDemandLoad_VA).toBe(13_000);
  });
});
