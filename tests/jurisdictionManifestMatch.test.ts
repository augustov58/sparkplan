/**
 * #135: a jurisdictions row resolves to the manifest of the AHJ it names.
 * Uses the real row shapes (name / city / county / state / ahj_name) — the
 * substring lookup sent "Miami, Miami-Dade County, FL" (City of Miami) to the
 * Miami-Dade County RER manifest and matched no manifest for
 * "Tampa, Hillsborough County, FL".
 */
import { describe, it, expect } from 'vitest';
import { ALL_MANIFESTS, findManifestForJurisdiction } from '../data/ahj/registry';

const row = (jurisdiction_name: string, city: string, county: string, state: string, ahj_name: string) =>
  ({ jurisdiction_name, city, county, state, ahj_name });

describe('findManifestForJurisdiction: every jurisdictions row', () => {
  it.each([
    [row('Davie, Broward County, FL', 'Davie', 'Broward', 'FL', 'Town of Davie Building Division'), 'davie'],
    [row('Miami, Miami-Dade County, FL', 'Miami', 'Miami-Dade', 'FL', 'City of Miami Building Department'), 'city-of-miami'],
    [row('Orlando, Orange County, FL', 'Orlando', 'Orange', 'FL', 'City of Orlando Building Department'), 'orlando'],
    [row('Pompano Beach, Broward County, FL', 'Pompano Beach', 'Broward', 'FL', 'City of Pompano Beach Building Division'), 'pompano'],
    [row('Hillsborough County / City of Tampa, FL', 'Tampa', 'Hillsborough', 'FL', 'Hillsborough County / City of Tampa Building Department'), 'hillsborough-tampa'],
    [row('Tampa, Hillsborough County, FL', 'Tampa', 'Hillsborough', 'FL', 'City of Tampa Building Department'), 'hillsborough-tampa'],
    [row('Austin, Travis County, TX', 'Austin', 'Travis', 'TX', 'City of Austin Development Services Department'), null],
    [row('Dallas, Dallas County, TX', 'Dallas', 'Dallas', 'TX', 'City of Dallas Development Services'), null],
    [row('Houston, Harris County, TX', 'Houston', 'Harris', 'TX', 'City of Houston Permitting Department'), null],
  ])('%o → %s', (jurisdiction, expected) => {
    expect(findManifestForJurisdiction(jurisdiction)?.id ?? null).toBe(expected);
  });
});

describe('findManifestForJurisdiction: county and city AHJs stay apart', () => {
  it('a county building department gets the county manifest', () => {
    expect(findManifestForJurisdiction(row('Unincorporated Miami-Dade County, FL', 'Miami', 'Miami-Dade', 'FL',
      'Miami-Dade County Department of Regulatory and Economic Resources'))?.id).toBe('miami-dade');
    expect(findManifestForJurisdiction(row('Unincorporated Orange County, FL', 'Orlando', 'Orange', 'FL',
      'Orange County Division of Building Safety'))?.id).toBe('orange-county');
  });

  it('an unmodeled city inside a modeled county gets no manifest', () => {
    expect(findManifestForJurisdiction(row('Miami Gardens, Miami-Dade County, FL', 'Miami Gardens', 'Miami-Dade', 'FL',
      'City of Miami Gardens Building Services'))).toBeNull();
    expect(findManifestForJurisdiction(row('Winter Park, Orange County, FL', 'Winter Park', 'Orange', 'FL',
      'City of Winter Park Building Department'))).toBeNull();
  });

  it('a same-named city in another state gets no manifest', () => {
    expect(findManifestForJurisdiction(row('Miami, Ottawa County, OK', 'Miami', 'Ottawa', 'OK', 'City of Miami'))).toBeNull();
  });

  it('St. Petersburg and Jacksonville match by city', () => {
    expect(findManifestForJurisdiction(row('St. Petersburg, Pinellas County, FL', 'Saint Petersburg', 'Pinellas', 'FL',
      'City of St. Petersburg Development Review Services'))?.id).toBe('st-petersburg');
    expect(findManifestForJurisdiction(row('Jacksonville, Duval County, FL', 'Jacksonville', 'Duval', 'FL',
      'City of Jacksonville Building Inspection Division'))?.id).toBe('jacksonville-duval');
  });

  it('name-only input: the most specific name wins, not registry order', () => {
    expect(findManifestForJurisdiction({ jurisdiction_name: 'Miami, Miami-Dade County, FL', ahj_name: 'City of Miami Building Department' })?.id)
      .toBe('city-of-miami');
  });

  it('every registered manifest declares its coverage', () => {
    for (const m of ALL_MANIFESTS) {
      expect(m.coverage?.state, m.id).toBe('FL');
      expect((m.coverage?.cities?.length ?? 0) + (m.coverage?.county ? 1 : 0), m.id).toBeGreaterThan(0);
    }
  });
});
