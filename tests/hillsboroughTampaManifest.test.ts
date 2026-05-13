/**
 * Sprint 2C M1 — Hillsborough/Tampa manifest tests.
 *
 * Pure-function tests validating:
 *  - Manifest parses as a valid `AHJManifest`
 *  - SFR + contractor-exemption residential trade-permit lane bypasses
 *    most requirements (H31 regression guard)
 *  - Commercial / multi-family receive the full requirement set
 *  - Requirement-count assertion (catches accidental adds/drops)
 *  - Section + artifact-type predicate splits behave per lane
 */

import { describe, it, expect } from 'vitest';
import { hillsboroughTampaManifest } from '../data/ahj/hillsborough-tampa';
import type {
  AHJContext,
  AHJManifest,
  AHJRequirement,
} from '../data/ahj/types';

// ----------------------------------------------------------------------------
// Context fixtures
// ----------------------------------------------------------------------------

/** The H31 residential-trade-permit-only lane (the lane the manifest
 *  is designed to bypass plan review for). */
const ctxResidentialTradePermit: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'single_family_residential',
  subjurisdiction: 'unincorporated_hillsborough',
};

/** Commercial new-service in Tampa — the heaviest packet path. */
const ctxCommercialNewService: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'commercial',
  subjurisdiction: 'city_of_tampa',
};

/** Commercial existing-service in unincorporated Hillsborough. */
const ctxCommercialExisting: AHJContext = {
  scope: 'existing-service',
  lane: 'pe_required',
  buildingType: 'commercial',
  subjurisdiction: 'unincorporated_hillsborough',
};

/** Multi-family — also rides the full plan-review lane. */
const ctxMultiFamily: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'multi_family',
  subjurisdiction: 'city_of_tampa',
};

/** Edge case: SFR + pe_required (a PE is on the project despite being
 *  single-family). Per manifest semantics, this is NOT the trade-permit
 *  lane — full plan-review applies. */
const ctxSfrWithPE: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'single_family_residential',
  subjurisdiction: 'unincorporated_hillsborough',
};

// ----------------------------------------------------------------------------
// Manifest shape
// ----------------------------------------------------------------------------

describe('hillsboroughTampaManifest — shape', () => {
  it('parses as a valid AHJManifest with expected identity', () => {
    const m: AHJManifest = hillsboroughTampaManifest;
    expect(m.id).toBe('hillsborough-tampa');
    expect(m.name).toBe('Hillsborough County / City of Tampa');
    expect(m.jurisdictionType).toBe('county');
    expect(m.subjurisdiction).toBeUndefined();
    expect(m.sheetIdPrefix).toBe('E-');
    expect(m.fbcEdition).toBe('FBC 8th ed (2023)');
  });

  it('cites NEC 2020 uniformly across all building types (no MD-style fork)', () => {
    expect(hillsboroughTampaManifest.necEdition.single_family_residential).toBe(
      'NEC 2020',
    );
    expect(hillsboroughTampaManifest.necEdition.multi_family).toBe('NEC 2020');
    expect(hillsboroughTampaManifest.necEdition.commercial).toBe('NEC 2020');
  });

  it('includes the operative FFPC + County/City code references', () => {
    const codes = hillsboroughTampaManifest.codeReferences.join('\n');
    expect(codes).toContain('NFPA-70 (2020 NEC)');
    expect(codes).toContain('Florida Building Code, 8th edition (2023)');
    // H37 guard — must NOT cite Tampa's stale "Codes In Use" editions.
    // Operative FFPC 8th ed must be present.
    expect(codes).toContain('Florida Fire Prevention Code, 8th edition');
    expect(codes).toContain('Hillsborough County');
    expect(codes).toContain('City of Tampa');
  });

  it('exposes a non-empty general-notes list', () => {
    expect(hillsboroughTampaManifest.generalNotes.length).toBeGreaterThan(0);
    // Trade-permit lane satisfies the "scope narrative" requirement via
    // generalNotes — make sure NEC + FBC references are present.
    const notes = hillsboroughTampaManifest.generalNotes.join(' ');
    expect(notes).toMatch(/NFPA-70/);
    expect(notes).toMatch(/Florida Building Code/);
  });
});

// ----------------------------------------------------------------------------
// Requirements — count + invariants
// ----------------------------------------------------------------------------

describe('hillsboroughTampaManifest — requirements list', () => {
  it('declares 21 requirements (regression guard for line-by-line cross-walk)', () => {
    // Pin the count so any add/drop forces a deliberate update + research
    // review. Current cross-walk distilled to 21 enforceable items:
    //   2 application + 3 narrative + 9 plan + 4 upload + 2 inspection +
    //   1 NOC upload = 21. (NOC sits in upload category alongside cut
    //   sheets / fire-stopping / private-provider / flood-cert.)
    expect(hillsboroughTampaManifest.requirements).toHaveLength(21);
  });

  it('uses unique stable IDs (no dupes)', () => {
    const ids = hillsboroughTampaManifest.requirements.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only the documented category enum values', () => {
    const allowed = new Set([
      'plan',
      'application',
      'narrative',
      'inspection',
      'upload',
    ]);
    for (const req of hillsboroughTampaManifest.requirements) {
      expect(allowed.has(req.category)).toBe(true);
    }
  });

  it('prefixes every requirement ID with the manifest id', () => {
    for (const req of hillsboroughTampaManifest.requirements) {
      expect(req.id.startsWith('hillsborough-tampa-')).toBe(true);
    }
  });
});

// ----------------------------------------------------------------------------
// H31 regression — residential trade-permit lane bypasses most reqs
// ----------------------------------------------------------------------------

describe('hillsboroughTampaManifest — H31 residential trade-permit lane', () => {
  /** Number of requirements that apply on a given context. */
  const countApplied = (ctx: AHJContext): number =>
    hillsboroughTampaManifest.requirements.filter((r) => r.required(ctx))
      .length;

  it('residential-trade-permit ctx applies materially FEWER requirements than commercial', () => {
    const trade = countApplied(ctxResidentialTradePermit);
    const commercial = countApplied(ctxCommercialNewService);
    expect(trade).toBeLessThan(commercial);
    // Sanity: trade-permit lane should be a small minimal envelope.
    // Currently: scope narrative + code-ref block + contractor signature
    // + cut sheet + EVSE labeling + EVEMS narrative + trade-permit
    // application = 7. Pin to "<= 8" so future tweaks don't accidentally
    // re-enable plan-review items on the trade-permit lane.
    expect(trade).toBeLessThanOrEqual(8);
  });

  it('residential-trade-permit ctx triggers the trade-permit application but NOT the commercial app', () => {
    const requiredIds = hillsboroughTampaManifest.requirements
      .filter((r) => r.required(ctxResidentialTradePermit))
      .map((r) => r.id);
    expect(requiredIds).toContain(
      'hillsborough-tampa-trade-permit-application',
    );
    expect(requiredIds).not.toContain(
      'hillsborough-tampa-commercial-electrical-permit',
    );
  });

  it('residential-trade-permit ctx does NOT require the plan-review artifacts', () => {
    const skipped = [
      'hillsborough-tampa-pe-seal',
      'hillsborough-tampa-site-plan',
      'hillsborough-tampa-riser-diagram',
      'hillsborough-tampa-panel-schedule',
      'hillsborough-tampa-load-calculations',
      'hillsborough-tampa-voltage-drop',
      'hillsborough-tampa-fault-current',
      'hillsborough-tampa-grounding',
      'hillsborough-tampa-existing-service-nec22087',
      'hillsborough-tampa-design-flood-elevation',
      'hillsborough-tampa-fire-stopping',
      'hillsborough-tampa-noc',
      'hillsborough-tampa-private-provider-doc',
    ];
    const reqsById = new Map<string, AHJRequirement>(
      hillsboroughTampaManifest.requirements.map((r) => [r.id, r]),
    );
    for (const id of skipped) {
      const req = reqsById.get(id);
      expect(req, `missing requirement ${id}`).toBeDefined();
      expect(
        req!.required(ctxResidentialTradePermit),
        `${id} should be skipped on trade-permit lane`,
      ).toBe(false);
    }
  });

  it('residential-trade-permit ctx STILL requires the always-on minimal envelope', () => {
    const requiredIds = hillsboroughTampaManifest.requirements
      .filter((r) => r.required(ctxResidentialTradePermit))
      .map((r) => r.id);
    // Always-on across every lane:
    expect(requiredIds).toContain('hillsborough-tampa-scope-narrative');
    expect(requiredIds).toContain('hillsborough-tampa-code-reference-block');
    expect(requiredIds).toContain('hillsborough-tampa-contractor-signature');
    expect(requiredIds).toContain('hillsborough-tampa-evse-cut-sheet');
    expect(requiredIds).toContain('hillsborough-tampa-evse-labeling');
  });
});

// ----------------------------------------------------------------------------
// Commercial lane — full requirement set applies
// ----------------------------------------------------------------------------

describe('hillsboroughTampaManifest — commercial full plan-review lane', () => {
  const requiredIdsFor = (ctx: AHJContext): string[] =>
    hillsboroughTampaManifest.requirements
      .filter((r) => r.required(ctx))
      .map((r) => r.id);

  it('commercial new-service ctx applies the commercial application + PE seal', () => {
    const ids = requiredIdsFor(ctxCommercialNewService);
    expect(ids).toContain('hillsborough-tampa-commercial-electrical-permit');
    expect(ids).toContain('hillsborough-tampa-pe-seal');
    expect(ids).not.toContain('hillsborough-tampa-trade-permit-application');
  });

  it('commercial new-service ctx triggers fault current + grounding (not NEC 220.87)', () => {
    const ids = requiredIdsFor(ctxCommercialNewService);
    expect(ids).toContain('hillsborough-tampa-fault-current');
    expect(ids).toContain('hillsborough-tampa-grounding');
    expect(ids).not.toContain('hillsborough-tampa-existing-service-nec22087');
  });

  it('commercial existing-service ctx triggers NEC 220.87 (not fault current / grounding)', () => {
    const ids = requiredIdsFor(ctxCommercialExisting);
    expect(ids).toContain('hillsborough-tampa-existing-service-nec22087');
    expect(ids).not.toContain('hillsborough-tampa-fault-current');
    expect(ids).not.toContain('hillsborough-tampa-grounding');
  });

  it('multi-family ctx triggers the commercial requirement set (full plan review)', () => {
    const ids = requiredIdsFor(ctxMultiFamily);
    expect(ids).toContain('hillsborough-tampa-commercial-electrical-permit');
    expect(ids).toContain('hillsborough-tampa-site-plan');
    expect(ids).toContain('hillsborough-tampa-riser-diagram');
    expect(ids).toContain('hillsborough-tampa-panel-schedule');
    expect(ids).toContain('hillsborough-tampa-noc');
  });

  it('SFR + pe_required is NOT the trade-permit lane (full plan review applies)', () => {
    // Edge case: contractor brought a PE despite single-family scope.
    // The manifest treats this as the full-plan-review lane because
    // isResidentialTradePermitLane requires lane === 'contractor_exemption'.
    const ids = requiredIdsFor(ctxSfrWithPE);
    expect(ids).toContain('hillsborough-tampa-commercial-electrical-permit');
    expect(ids).toContain('hillsborough-tampa-pe-seal');
    expect(ids).not.toContain('hillsborough-tampa-trade-permit-application');
  });

  it('design flood elevation is gated to commercial only (H30)', () => {
    expect(requiredIdsFor(ctxCommercialNewService)).toContain(
      'hillsborough-tampa-design-flood-elevation',
    );
    expect(requiredIdsFor(ctxMultiFamily)).not.toContain(
      'hillsborough-tampa-design-flood-elevation',
    );
    expect(requiredIdsFor(ctxResidentialTradePermit)).not.toContain(
      'hillsborough-tampa-design-flood-elevation',
    );
  });

  it('private provider documentation is commercial-only opt-in (H33)', () => {
    expect(requiredIdsFor(ctxCommercialNewService)).toContain(
      'hillsborough-tampa-private-provider-doc',
    );
    expect(requiredIdsFor(ctxMultiFamily)).not.toContain(
      'hillsborough-tampa-private-provider-doc',
    );
  });
});

// ----------------------------------------------------------------------------
// Section + artifact-type predicate splits (Layer 1 manifest defaults)
// ----------------------------------------------------------------------------

describe('hillsboroughTampaManifest — predicate splits', () => {
  it('section predicates gate engineering pages off on trade-permit lane', () => {
    const preds = hillsboroughTampaManifest.sectionPredicates;
    expect(preds).toBeDefined();
    // Engineering pages — all gated to full-plan-review lane.
    expect(preds!.loadCalculation!(ctxResidentialTradePermit)).toBe(false);
    expect(preds!.loadCalculation!(ctxCommercialNewService)).toBe(true);
    expect(preds!.voltageDrop!(ctxResidentialTradePermit)).toBe(false);
    expect(preds!.shortCircuit!(ctxResidentialTradePermit)).toBe(false);
    expect(preds!.riserDiagram!(ctxResidentialTradePermit)).toBe(false);
    expect(preds!.panelSchedules!(ctxResidentialTradePermit)).toBe(false);
  });

  it('NEC 220.87 narrative gates on BOTH lane AND existing-service scope', () => {
    const pred = hillsboroughTampaManifest.sectionPredicates!.nec22087Narrative!;
    expect(pred(ctxResidentialTradePermit)).toBe(false); // trade-permit lane
    expect(pred(ctxCommercialNewService)).toBe(false); // wrong scope
    expect(pred(ctxCommercialExisting)).toBe(true); // commercial + existing
  });

  it('available fault current gates on BOTH lane AND new-service scope', () => {
    const pred =
      hillsboroughTampaManifest.sectionPredicates!.availableFaultCurrent!;
    expect(pred(ctxResidentialTradePermit)).toBe(false);
    expect(pred(ctxCommercialExisting)).toBe(false);
    expect(pred(ctxCommercialNewService)).toBe(true);
  });

  it('multi-family-only sections gate on building type', () => {
    const preds = hillsboroughTampaManifest.sectionPredicates!;
    expect(preds.meterStack!(ctxMultiFamily)).toBe(true);
    expect(preds.meterStack!(ctxCommercialNewService)).toBe(false);
    expect(preds.multiFamilyEV!(ctxResidentialTradePermit)).toBe(false);
  });

  it('artifact-type predicates gate site_plan + fire_stopping by lane', () => {
    const preds = hillsboroughTampaManifest.artifactTypePredicates!;
    expect(preds.site_plan!(ctxResidentialTradePermit)).toBe(false);
    expect(preds.site_plan!(ctxCommercialNewService)).toBe(true);
    expect(preds.fire_stopping!(ctxResidentialTradePermit)).toBe(false);
    expect(preds.fire_stopping!(ctxMultiFamily)).toBe(true);
  });

  it('NOC predicate matches the Orlando rule (off for SFR, on for non-SFR)', () => {
    const pred = hillsboroughTampaManifest.artifactTypePredicates!.noc!;
    expect(pred(ctxResidentialTradePermit)).toBe(false);
    expect(pred(ctxSfrWithPE)).toBe(false); // still SFR — same rule
    expect(pred(ctxCommercialNewService)).toBe(true);
    expect(pred(ctxMultiFamily)).toBe(true);
  });

  it('flood + private-provider artifact predicates gate to commercial only', () => {
    const preds = hillsboroughTampaManifest.artifactTypePredicates!;
    expect(preds.flood_elevation_certificate!(ctxCommercialNewService)).toBe(
      true,
    );
    expect(preds.flood_elevation_certificate!(ctxMultiFamily)).toBe(false);
    expect(preds.private_provider_documentation!(ctxCommercialExisting)).toBe(
      true,
    );
    expect(
      preds.private_provider_documentation!(ctxResidentialTradePermit),
    ).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Detect functions — sanity (engine integration uses these)
// ----------------------------------------------------------------------------

describe('hillsboroughTampaManifest — detect functions', () => {
  it('scope-narrative detect picks up generalNotes section presence', () => {
    const req = hillsboroughTampaManifest.requirements.find(
      (r) => r.id === 'hillsborough-tampa-scope-narrative',
    )!;
    expect(req.detect({ sectionKeys: ['generalNotes'] }, [])).toBe(true);
    expect(req.detect({ sectionKeys: [] }, [])).toBe(false);
  });

  it('site-plan detect picks up the site_plan attachment', () => {
    const req = hillsboroughTampaManifest.requirements.find(
      (r) => r.id === 'hillsborough-tampa-site-plan',
    )!;
    expect(req.detect({}, [{ artifactType: 'site_plan' }])).toBe(true);
    expect(req.detect({}, [{ artifactType: 'cut_sheet' }])).toBe(false);
    expect(req.detect({}, [])).toBe(false);
  });

  it('NOC detect picks up the noc attachment', () => {
    const req = hillsboroughTampaManifest.requirements.find(
      (r) => r.id === 'hillsborough-tampa-noc',
    )!;
    expect(req.detect({}, [{ artifactType: 'noc' }])).toBe(true);
    expect(req.detect({}, [{ artifactType: 'site_plan' }])).toBe(false);
  });
});
